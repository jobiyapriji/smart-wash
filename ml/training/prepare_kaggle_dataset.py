"""
SMART WASH — Kaggle Dataset Landmark Extraction & Sequence Pipeline
Processes 300 videos from the Kaggle WHO Handwashing Dataset:
- 12 folders across 7 WHO steps (including Left/Right variants)
- Maps Left & Right actions to the 6 core WHO steps (Classes 1-6)
- Maps Step 7 (wrist rubbing) and synthetic idle/absent frames to Class 0 (background)
- Canonical wrist-centered & palm-scale normalized 126-D hand landmarks
- Parallel multiprocessing with MediaPipe Tasks HandLandmarker
- Stratified augmentation & balanced sequence generation
- Exports dataset_landmarks.npz and annotations_kaggle.json
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import cv2
import mediapipe as mp
from concurrent.futures import ProcessPoolExecutor

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

FEATURE_DIM = 126       # 2 hands * 21 landmarks * 3 coordinates (x, y, z)
HAND_FEATURE_DIM = 63   # 21 landmarks * 3 coordinates
SEQUENCE_LENGTH = 30    # 30 frames per temporal sequence (approx 1.0 - 1.5s)

FOLDER_CLASS_MAPPING = {
    "Step_1": {"class_id": 1, "action": "Step_1", "stride": 3},
    "Step_2_Left": {"class_id": 2, "action": "Step_2", "stride": 6},
    "Step_2_Right": {"class_id": 2, "action": "Step_2", "stride": 6},
    "Step_3": {"class_id": 3, "action": "Step_3", "stride": 3},
    "Step_4_Left": {"class_id": 4, "action": "Step_4", "stride": 6},
    "Step_4_Right": {"class_id": 4, "action": "Step_4", "stride": 6},
    "Step_5_Left": {"class_id": 5, "action": "Step_5", "stride": 6},
    "Step_5_Right": {"class_id": 5, "action": "Step_5", "stride": 6},
    "Step_6_Left": {"class_id": 6, "action": "Step_6", "stride": 6},
    "Step_6_Right": {"class_id": 6, "action": "Step_6", "stride": 6},
    "Step_7_Left": {"class_id": 0, "action": "Step_7_Wrists_Negative", "stride": 6},
    "Step_7_Right": {"class_id": 0, "action": "Step_7_Wrists_Negative", "stride": 6},
}

CLASS_NAMES = {
    0: "background",
    1: "Step_1",
    2: "Step_2",
    3: "Step_3",
    4: "Step_4",
    5: "Step_5",
    6: "Step_6"
}

def normalize_single_hand(landmarks_21):
    """
    Normalizes a single hand's 21 landmarks:
    - Origin at wrist (landmark 0).
    - Scale divided by distance between wrist (0) and middle finger MCP (9).
    """
    pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks_21], dtype=np.float32)
    wrist = pts[0]
    translated = pts - wrist
    middle_mcp = translated[9]
    scale = np.linalg.norm(middle_mcp)
    if scale > 1e-5:
        normalized = translated / scale
    else:
        normalized = translated
    return normalized.flatten()

def format_frame_landmarks(hand_landmarks_list, handedness_list):
    """
    Constructs a 126-dimensional canonical vector for 2 hands:
    - [0:63] = Left Hand
    - [63:126] = Right Hand
    If single hand detected, mirrors into opposing slot when merged or slots appropriately.
    """
    feat = np.zeros(FEATURE_DIM, dtype=np.float32)
    if not hand_landmarks_list:
        return feat

    num_hands = len(hand_landmarks_list)
    if num_hands == 1:
        label = handedness_list[0][0].category_name if handedness_list else "Right"
        hand_norm = normalize_single_hand(hand_landmarks_list[0])
        
        # Mirror hand to simulate merged hand overlap
        mirrored = hand_norm.copy().reshape(-1, 3)
        mirrored[:, 0] = -mirrored[:, 0]
        mirrored_flat = mirrored.flatten()

        if label.lower() == "left":
            feat[0:HAND_FEATURE_DIM] = hand_norm
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = mirrored_flat
        else:
            feat[0:HAND_FEATURE_DIM] = mirrored_flat
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = hand_norm
    else:
        h0_label = handedness_list[0][0].category_name.lower() if handedness_list else "left"
        h1_label = handedness_list[1][0].category_name.lower() if len(handedness_list) > 1 else "right"
        
        h0_norm = normalize_single_hand(hand_landmarks_list[0])
        h1_norm = normalize_single_hand(hand_landmarks_list[1])
        
        if h0_label == "left" and h1_label == "right":
            feat[0:HAND_FEATURE_DIM] = h0_norm
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = h1_norm
        elif h0_label == "right" and h1_label == "left":
            feat[0:HAND_FEATURE_DIM] = h1_norm
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = h0_norm
        else:
            x0 = hand_landmarks_list[0][0].x
            x1 = hand_landmarks_list[1][0].x
            if x0 < x1:
                feat[0:HAND_FEATURE_DIM] = h0_norm
                feat[HAND_FEATURE_DIM:FEATURE_DIM] = h1_norm
            else:
                feat[0:HAND_FEATURE_DIM] = h1_norm
                feat[HAND_FEATURE_DIM:FEATURE_DIM] = h0_norm
    return feat

def augment_sequence_flip(seq):
    """Horizontal flip: invert x coordinate and swap Left and Right hand slots."""
    flipped = seq.copy()
    left_slot = flipped[:, 0:HAND_FEATURE_DIM].copy().reshape(-1, 21, 3)
    right_slot = flipped[:, HAND_FEATURE_DIM:FEATURE_DIM].copy().reshape(-1, 21, 3)
    left_slot[:, :, 0] = -left_slot[:, :, 0]
    right_slot[:, :, 0] = -right_slot[:, :, 0]
    flipped[:, 0:HAND_FEATURE_DIM] = right_slot.reshape(-1, HAND_FEATURE_DIM)
    flipped[:, HAND_FEATURE_DIM:FEATURE_DIM] = left_slot.reshape(-1, HAND_FEATURE_DIM)
    return flipped

def augment_sequence_rotate(seq, angle_deg=10.0):
    """Minor 2D plane rotation to simulate camera roll variation."""
    theta = np.radians(angle_deg)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    rotated = seq.copy()
    for offset in (0, HAND_FEATURE_DIM):
        for p in range(0, HAND_FEATURE_DIM, 3):
            x = rotated[:, offset + p]
            y = rotated[:, offset + p + 1]
            rotated[:, offset + p] = x * cos_t - y * sin_t
            rotated[:, offset + p + 1] = x * sin_t + y * cos_t
    return rotated

def augment_sequence_noise(seq, sigma=0.012):
    """Gaussian noise on non-zero landmark coordinates."""
    noise = np.random.normal(0, sigma, seq.shape).astype(np.float32)
    mask = (seq != 0.0).astype(np.float32)
    return seq + (noise * mask)

def augment_sequence_scale(seq, factor=1.12):
    """Slight scale change simulating distance differences."""
    scaled = seq.copy()
    mask = (scaled != 0.0)
    scaled[mask] *= factor
    return scaled

def augment_sequence_dropout(seq, drop_hand="left"):
    """Zero out one hand to simulate physical hand occlusion during rubbing."""
    dropped = seq.copy()
    if drop_hand == "left":
        dropped[:, 0:HAND_FEATURE_DIM] = 0.0
    else:
        dropped[:, HAND_FEATURE_DIM:FEATURE_DIM] = 0.0
    return dropped

def extract_video_features(task_info):
    """Worker function to extract raw 126-D landmarks from a video file."""
    vpath, model_path, class_id, stride, folder_name = task_info
    fn = os.path.basename(vpath)

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=VisionRunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3
    )

    cap = cv2.VideoCapture(vpath)
    if not cap.isOpened():
        return fn, class_id, [], 0.0, 0, folder_name

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_feats = []

    with HandLandmarker.create_from_options(options) as lm:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            h, w = frame.shape[:2]
            if max(h, w) > 1280:
                scale = 1280.0 / max(h, w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            res = lm.detect(mp_img)

            feat = format_frame_landmarks(res.hand_landmarks, res.handedness)
            frame_feats.append(feat)

    cap.release()
    total_frames = len(frame_feats)
    return fn, class_id, frame_feats, fps, total_frames, folder_name

def process_dataset(dataset_root, model_path, output_npz, output_json, max_workers=6):
    print(f"[PREPARE] Discovering video files in: {dataset_root}")
    tasks = []
    manifest = []

    for folder_name, cfg in FOLDER_CLASS_MAPPING.items():
        folder_path = os.path.join(dataset_root, folder_name)
        if not os.path.isdir(folder_path):
            print(f"[WARN] Folder not found: {folder_path}")
            continue

        videos = [f for f in sorted(os.listdir(folder_path)) if f.lower().endswith(('.mp4', '.avi', '.mov'))]
        print(f"  Folder '{folder_name}' -> Class {cfg['class_id']} ({cfg['action']}): Found {len(videos)} videos")

        for v in videos:
            vpath = os.path.join(folder_path, v)
            tasks.append((vpath, model_path, cfg["class_id"], cfg["stride"], folder_name))

    print(f"\n[PREPARE] Total video extraction tasks queued: {len(tasks)}")
    print(f"[PREPARE] Spawning {max_workers} worker processes for parallel MediaPipe extraction...")

    t0 = time.time()
    extracted_results = []
    
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        for idx, res in enumerate(executor.map(extract_video_features, tasks), 1):
            fn, class_id, frame_feats, fps, total_frames, folder_name = res
            extracted_results.append(res)
            if idx % 20 == 0 or idx == len(tasks):
                elapsed = time.time() - t0
                avg = elapsed / idx
                rem = (len(tasks) - idx) * avg
                print(f"  [{idx:3d}/{len(tasks)}] Processed {fn} ({total_frames} frames). Elapsed: {elapsed:.1f}s | Est. remaining: {rem:.1f}s")

    total_extract_time = time.time() - t0
    print(f"\n[PREPARE] Landmark extraction completed in {total_extract_time:.1f}s ({total_extract_time/len(tasks):.2f}s per video).")

    # Sequence Generation & Augmentation
    print("[PREPARE] Slicing temporal sequences (seq_len=30) and applying augmentations...")
    X_sequences = []
    y_labels = []
    video_sources = []

    for fn, class_id, frame_feats, fps, total_frames, folder_name in extracted_results:
        cfg = FOLDER_CLASS_MAPPING.get(folder_name, {"stride": 4})
        stride = cfg["stride"]
        feats_arr = np.array(frame_feats, dtype=np.float32)

        manifest.append({
            "filename": fn,
            "folder": folder_name,
            "class_id": class_id,
            "action": cfg.get("action", f"Class_{class_id}"),
            "fps": fps,
            "total_frames": total_frames,
            "duration_sec": round(total_frames / fps if fps else 0.0, 2)
        })

        if len(feats_arr) < SEQUENCE_LENGTH:
            continue

        # Slicing with stride
        for start in range(0, len(feats_arr) - SEQUENCE_LENGTH + 1, stride):
            seq = feats_arr[start : start + SEQUENCE_LENGTH]

            # 1. Base sequence
            X_sequences.append(seq)
            y_labels.append(class_id)
            video_sources.append(fn)

            # 2. Horizontal Flip (Mirroring invariance)
            flipped = augment_sequence_flip(seq)
            X_sequences.append(flipped)
            y_labels.append(class_id)
            video_sources.append(fn)

            # 3. Minor Rotation +10° and -10°
            X_sequences.append(augment_sequence_rotate(seq, +10.0))
            y_labels.append(class_id)
            video_sources.append(fn)

            X_sequences.append(augment_sequence_rotate(seq, -10.0))
            y_labels.append(class_id)
            video_sources.append(fn)

            # 4. Sensor Gaussian noise
            X_sequences.append(augment_sequence_noise(seq))
            y_labels.append(class_id)
            video_sources.append(fn)

            # 5. Hand scale variation
            X_sequences.append(augment_sequence_scale(seq, 1.12))
            y_labels.append(class_id)
            video_sources.append(fn)

            # 6. Physical occlusion dropout
            X_sequences.append(augment_sequence_dropout(seq, "left"))
            y_labels.append(class_id)
            video_sources.append(fn)

            X_sequences.append(augment_sequence_dropout(seq, "right"))
            y_labels.append(class_id)
            video_sources.append(fn)

    # Synthesize Class 0 background frames to accompany Step 7 (wrists)
    target_bg_count = max(3500, len([y for y in y_labels if y == 1]))
    current_bg_count = len([y for y in y_labels if y == 0])
    synth_needed = max(1500, target_bg_count - current_bg_count)
    print(f"[PREPARE] Current Class 0 from Step 7 (wrists): {current_bg_count}. Synthesizing {synth_needed} idle/resting background sequences...")

    for b in range(synth_needed):
        sub = b % 4
        if sub == 0:
            # Completely absent hands
            bg_seq = np.zeros((SEQUENCE_LENGTH, FEATURE_DIM), dtype=np.float32)
        elif sub == 1:
            # Resting still hands
            base_hand = np.random.uniform(-0.4, 0.4, (FEATURE_DIM,)).astype(np.float32)
            bg_seq = np.tile(base_hand, (SEQUENCE_LENGTH, 1))
        elif sub == 2:
            # Minor random jitter
            base_hand = np.random.uniform(-0.3, 0.3, (FEATURE_DIM,)).astype(np.float32)
            bg_seq = np.tile(base_hand, (SEQUENCE_LENGTH, 1)) + np.random.normal(0, 0.006, (SEQUENCE_LENGTH, FEATURE_DIM)).astype(np.float32)
        else:
            # Non-washing motion (reaching gesture)
            t_steps = np.linspace(0, 1, SEQUENCE_LENGTH)[:, None]
            path = np.sin(t_steps * np.pi) * 0.35
            base = np.random.uniform(-0.2, 0.2, (1, FEATURE_DIM)).astype(np.float32)
            bg_seq = base + path.astype(np.float32)

        X_sequences.append(bg_seq)
        y_labels.append(0)
        video_sources.append("synthetic_bg")

    X = np.array(X_sequences, dtype=np.float32)
    y = np.array(y_labels, dtype=np.int64)
    v_src = np.array(video_sources)

    print(f"\n[DATASET READY] Total dataset shape: X={X.shape}, y={y.shape}")
    print("[CLASS DISTRIBUTION]")
    for cid in range(7):
        cname = CLASS_NAMES[cid]
        c_count = int(np.sum(y == cid))
        pct = (c_count / len(y)) * 100.0
        print(f"  Class {cid} ({cname:10s}): {c_count:5d} sequences ({pct:4.1f}%)")

    # Save NPZ
    np.savez_compressed(
        output_npz,
        X=X,
        y=y,
        video_sources=v_src,
        classes=json.dumps(CLASS_NAMES),
        feature_dim=FEATURE_DIM,
        seq_length=SEQUENCE_LENGTH
    )
    print(f"\n[SAVED] NPZ feature dataset saved to: {output_npz} ({os.path.getsize(output_npz) / (1024*1024):.2f} MB)")

    # Save JSON manifest
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({
            "dataset_version": "2.0-kaggle",
            "source": "https://www.kaggle.com/datasets/realtimear/hand-wash-dataset",
            "total_videos": len(manifest),
            "classes": CLASS_NAMES,
            "videos": manifest
        }, f, indent=2)
    print(f"[SAVED] Dataset JSON manifest saved to: {output_json}")

def main():
    parser = argparse.ArgumentParser(description="Kaggle Handwash Dataset Landmark Feature Extractor")
    parser.add_argument("--dataset-root", type=str,
                        default=r"C:\Users\jobiy\.cache\kagglehub\datasets\realtimear\hand-wash-dataset\versions\4\HandWashDataset\HandWashDataset",
                        help="Path to extracted Kaggle HandWashDataset directory")
    parser.add_argument("--model-path", type=str,
                        default=r"c:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main\backend\models\mediapipe\hand_landmarker.task",
                        help="Path to hand_landmarker.task")
    parser.add_argument("--output-npz", type=str,
                        default=r"c:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main\ml\training\dataset_landmarks.npz",
                        help="Path to output dataset_landmarks.npz")
    parser.add_argument("--output-json", type=str,
                        default=r"c:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main\ml\training\annotations_kaggle.json",
                        help="Path to output annotations_kaggle.json")
    parser.add_argument("--workers", type=int, default=6, help="Number of worker processes")
    args = parser.parse_args()

    process_dataset(
        dataset_root=args.dataset_root,
        model_path=args.model_path,
        output_npz=args.output_npz,
        output_json=args.output_json,
        max_workers=args.workers
    )

if __name__ == "__main__":
    main()
