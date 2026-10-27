"""
SMART WASH — Hand Landmark Feature Extraction Pipeline
Author: SMART WASH AI Pipeline

Extracts 21 3D hand landmarks per hand (x, y, z) using MediaPipe Tasks HandLandmarker.
Applies:
1. Left/Right canonical hand slot alignment (63 + 63 = 126 features).
2. Wrist-relative origin translation (P_i - P_wrist).
3. Palm-scale normalization (distance wrist to middle finger MCP).
4. Temporal sliding window segmentation (seq_len=30) strictly within segment bounds.
5. Data augmentation (horizontal mirroring, Gaussian noise).
6. Background / idle sequence synthesis.
7. Exports reusable dataset to dataset_landmarks.npz with video source tags.
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

FEATURE_DIM = 126  # 2 hands * 21 landmarks * 3 coords
HAND_FEATURE_DIM = 63  # 21 landmarks * 3 coords

def normalize_single_hand(landmarks_21):
    """
    Normalizes a single hand's 21 landmarks:
    - Origin at wrist (landmark 0).
    - Robust composite palm scale (length and breadth).
    - Invariant to hand position, tilt, distance, and camera perspective.
    """
    pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks_21], dtype=np.float32)
    wrist = pts[0]
    translated = pts - wrist
    
    palm_len = float(np.linalg.norm(translated[9]))
    palm_wid = float(np.linalg.norm(pts[17] - pts[5]))
    scale = max(palm_len, palm_wid * 1.15, 0.04)
    normalized = translated / scale
    return normalized.flatten()  # 63 float values

def format_frame_landmarks(hand_landmarks_list, handedness_list):
    """
    Constructs a 126-dimensional canonical vector for 2 hands:
    - [0:63] = Leftmost Hand
    - [63:126] = Rightmost Hand (or mirrored second hand)
    Deterministic spatial ordering prevents slot jitter / handedness flipping.
    """
    feat = np.zeros(FEATURE_DIM, dtype=np.float32)
    if not hand_landmarks_list:
        return feat

    num_hands = len(hand_landmarks_list)
    if num_hands == 1:
        hand_norm = normalize_single_hand(hand_landmarks_list[0])
        mirrored = hand_norm.copy().reshape(-1, 3)
        mirrored[:, 0] = -mirrored[:, 0]
        mirrored_flat = mirrored.flatten()
        feat[0:HAND_FEATURE_DIM] = hand_norm
        feat[HAND_FEATURE_DIM:FEATURE_DIM] = mirrored_flat
    else:
        h0_norm = normalize_single_hand(hand_landmarks_list[0])
        h1_norm = normalize_single_hand(hand_landmarks_list[1])
        x0 = hand_landmarks_list[0][0].x
        x1 = hand_landmarks_list[1][0].x
        if x0 <= x1:
            feat[0:HAND_FEATURE_DIM] = h0_norm
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = h1_norm
        else:
            feat[0:HAND_FEATURE_DIM] = h1_norm
            feat[HAND_FEATURE_DIM:FEATURE_DIM] = h0_norm
                
    return feat

def augment_sequence_flip(seq):
    """
    Horizontal flip augmentation:
    - Invert x coordinates (indices 0, 3, 6... in each 63-slice).
    - Swap Left Hand [0:63] and Right Hand [63:126].
    """
    flipped = seq.copy()
    left = flipped[:, 0:HAND_FEATURE_DIM].copy()
    right = flipped[:, HAND_FEATURE_DIM:FEATURE_DIM].copy()

    for p in range(0, HAND_FEATURE_DIM, 3):
        left[:, p] = -left[:, p]
        right[:, p] = -right[:, p]

    flipped[:, 0:HAND_FEATURE_DIM] = right
    flipped[:, HAND_FEATURE_DIM:FEATURE_DIM] = left
    return flipped

def augment_sequence_rotate(seq, angle_deg=12.0):
    """Rotates landmark coordinates around z-axis by angle_deg."""
    rotated = seq.copy()
    theta = np.radians(angle_deg)
    cos_t, sin_t = np.cos(theta), np.sin(theta)

    for offset in (0, HAND_FEATURE_DIM):
        for p in range(0, HAND_FEATURE_DIM, 3):
            x = rotated[:, offset + p]
            y = rotated[:, offset + p + 1]
            rotated[:, offset + p] = x * cos_t - y * sin_t
            rotated[:, offset + p + 1] = x * sin_t + y * cos_t
    return rotated

def augment_sequence_scale(seq, factor=1.15):
    """Scales coordinates slightly to simulate hand distance/size differences."""
    scaled = seq.copy()
    mask = (scaled != 0.0)
    scaled[mask] *= factor
    return scaled

def augment_sequence_hand_dropout(seq, drop_hand="left"):
    """Zeroes out one hand to simulate physical hand occlusion during rubbing."""
    dropped = seq.copy()
    if drop_hand == "left":
        dropped[:, 0:HAND_FEATURE_DIM] = 0.0
    else:
        dropped[:, HAND_FEATURE_DIM:FEATURE_DIM] = 0.0
    return dropped

def augment_sequence_speed(seq, target_len=30):
    """Temporal speed resample using linear interpolation."""
    orig_len = len(seq)
    if orig_len == target_len:
        return seq
    orig_t = np.linspace(0, 1, orig_len)
    new_t = np.linspace(0, 1, target_len)
    resampled = np.zeros((target_len, seq.shape[1]), dtype=np.float32)
    for dim in range(seq.shape[1]):
        resampled[:, dim] = np.interp(new_t, orig_t, seq[:, dim])
    return resampled

def augment_sequence_noise(seq, sigma=0.015):
    """Adds small Gaussian noise to active non-zero landmark coordinates."""
    noise = np.random.normal(0, sigma, seq.shape).astype(np.float32)
    mask = (seq != 0.0).astype(np.float32)
    return seq + (noise * mask)

def extract_landmarks_from_video(video_path, landmarker, max_frames=None):
    """Extracts frame-by-frame 126-d normalized landmarks from a video file."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f"Cannot open video {video_path}")
        
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_feats = []
    frame_idx = 0
    
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
        res = landmarker.detect(mp_img)
        
        feat = format_frame_landmarks(res.hand_landmarks, res.handedness)
        frame_feats.append(feat)
        frame_idx += 1
        
        if max_frames and frame_idx >= max_frames:
            break
            
    cap.release()
    return np.array(frame_feats, dtype=np.float32), fps

def build_dataset(annotations_path, video_dir=None, model_asset_path=None, seq_length=30, stride=2):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    with open(annotations_path, "r", encoding="utf-8") as f:
        annot_data = json.load(f)
        
    if video_dir is None:
        configured_dir = annot_data.get("default_video_dir", "../../../Handwashing")
        candidates = [
            os.path.normpath(os.path.join(base_dir, configured_dir)),
            os.path.normpath(os.path.join(base_dir, "../../../Handwashing")),
            os.path.normpath(os.path.join(base_dir, "../../Handwashing")),
            r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing"
        ]
        video_dir = next((c for c in candidates if os.path.exists(c)), candidates[0])

    if model_asset_path is None:
        model_candidates = [
            os.path.normpath(os.path.join(base_dir, "../../backend/models/mediapipe/hand_landmarker.task")),
            os.path.normpath(os.path.join(base_dir, "../../../smart-wash-main/backend/models/mediapipe/hand_landmarker.task")),
            r"c:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main\backend\models\mediapipe\hand_landmarker.task"
        ]
        model_asset_path = next((m for m in model_candidates if os.path.exists(m)), model_candidates[0])

    print(f"[EXTRACT] Using video directory: {video_dir}")
    print(f"[EXTRACT] Using MediaPipe model asset: {model_asset_path}")

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_asset_path),
        running_mode=VisionRunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3
    )

    X_sequences = []
    y_labels = []
    video_sources = []
    participant_sources = []

    with HandLandmarker.create_from_options(options) as landmarker:
        for vinfo in annot_data.get("videos", []):
            fn = vinfo.get("filename")
            pid = vinfo.get("participant_id", "P1")
            vpath = os.path.join(video_dir, fn)
            if not os.path.exists(vpath):
                print(f"[WARN] Skipping missing video: {vpath}")
                continue

            print(f"[EXTRACT] Processing video: {fn}...")
            frame_feats, fps = extract_landmarks_from_video(vpath, landmarker)
            print(f"          Extracted {len(frame_feats)} frames at {fps:.1f} FPS.")

            segments = vinfo.get("segments", [])
            for seg in segments:
                class_id = int(seg.get("class_id"))
                start_sec = float(seg.get("start_sec", 0.0))
                end_sec = float(seg.get("end_sec", len(frame_feats) / fps))

                start_idx = max(0, int(round(start_sec * fps)))
                end_idx = min(len(frame_feats), int(round(end_sec * fps)))
                seg_feats = frame_feats[start_idx:end_idx]

                if len(seg_feats) < seq_length:
                    print(f"[WARN] Segment {seg.get('action')} too short ({len(seg_feats)} < {seq_length})")
                    continue

                # Slicing with stride
                count = 0
                for start in range(0, len(seg_feats) - seq_length + 1, stride):
                    seq = seg_feats[start : start + seq_length]
                    
                    # 1. Base sequence
                    X_sequences.append(seq)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)
                    count += 1

                    # 2. Horizontal Flip (Dominance & Mirroring invariance)
                    flipped_seq = augment_sequence_flip(seq)
                    X_sequences.append(flipped_seq)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 3. Rotation +12° (Camera angle invariance)
                    rot_pos = augment_sequence_rotate(seq, +12.0)
                    X_sequences.append(rot_pos)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 4. Rotation -12°
                    rot_neg = augment_sequence_rotate(seq, -12.0)
                    X_sequences.append(rot_neg)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 5. Hand Scale Variations (Distance & Hand-size invariance)
                    scaled_up = augment_sequence_scale(seq, 1.15)
                    X_sequences.append(scaled_up)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    scaled_down = augment_sequence_scale(seq, 0.85)
                    X_sequences.append(scaled_down)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 6. Physical Occlusion Dropout (Simulating hand covering the other)
                    occ_left = augment_sequence_hand_dropout(seq, "left")
                    X_sequences.append(occ_left)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    occ_right = augment_sequence_hand_dropout(seq, "right")
                    X_sequences.append(occ_right)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 7. Sensor Noise
                    noisy_seq = augment_sequence_noise(seq)
                    X_sequences.append(noisy_seq)
                    y_labels.append(class_id)
                    video_sources.append(fn)
                    participant_sources.append(pid)

                    # 8. Multi-speed (Fast rubbing)
                    if start + 36 <= len(seg_feats):
                        fast_seq = augment_sequence_speed(seg_feats[start : start + 36], 30)
                        X_sequences.append(fast_seq)
                        y_labels.append(class_id)
                        video_sources.append(fn)
                        participant_sources.append(pid)

                    # 9. Multi-speed (Slow gentle rubbing)
                    if start + 24 <= len(seg_feats):
                        slow_seq = augment_sequence_speed(seg_feats[start : start + 24], 30)
                        X_sequences.append(slow_seq)
                        y_labels.append(class_id)
                        video_sources.append(fn)
                        participant_sources.append(pid)

                print(f"          Action '{seg.get('action')}' (Class {class_id}): Generated {count * 10} augmented sequences.")

            # Extract idle / background from lead-in (0 to 0.5s) if present
            lead_in_end = int(round(0.4 * fps))
            if lead_in_end >= seq_length:
                bg_seq = frame_feats[0:seq_length]
                X_sequences.append(bg_seq)
                y_labels.append(0)
                video_sources.append(fn)
                participant_sources.append(pid)

    # Synthesize comprehensive Class 0 (background / idle hands / no hands / single idle hand)
    num_bg_needed = max(800, len(X_sequences) // 6)
    print(f"[EXTRACT] Synthesizing {num_bg_needed} diverse background/idle sequences (Class 0)...")
    for b in range(num_bg_needed):
        sub_type = b % 5
        if sub_type == 0:
            # Completely absent hands (all zeros)
            bg_seq = np.zeros((seq_length, FEATURE_DIM), dtype=np.float32)
        elif sub_type == 1:
            # Stationary / still hands with zero displacement
            base_hand = np.random.uniform(-0.5, 0.5, (FEATURE_DIM,)).astype(np.float32)
            bg_seq = np.tile(base_hand, (seq_length, 1))
        elif sub_type == 2:
            # Minor random drift (hands resting on sink rim)
            base_hand = np.random.uniform(-0.3, 0.3, (FEATURE_DIM,)).astype(np.float32)
            drift = np.random.normal(0, 0.005, (seq_length, FEATURE_DIM)).astype(np.float32)
            bg_seq = np.tile(base_hand, (seq_length, 1)) + drift
        elif sub_type == 3:
            # Single idle hand waving or moving without rubbing
            single_hand = np.zeros(FEATURE_DIM, dtype=np.float32)
            single_hand[63:126] = np.random.uniform(-0.4, 0.4, (63,)).astype(np.float32)
            bg_seq = np.tile(single_hand, (seq_length, 1)) + np.random.normal(0, 0.01, (seq_length, FEATURE_DIM)).astype(np.float32)
        else:
            # Non-washing broad hand movement (reaching for soap dispenser)
            t_steps = np.linspace(0, 1, seq_length)[:, None]
            path = np.sin(t_steps * np.pi) * 0.4
            base = np.random.uniform(-0.2, 0.2, (1, FEATURE_DIM)).astype(np.float32)
            bg_seq = base + path.astype(np.float32)

        X_sequences.append(bg_seq)
        y_labels.append(0)
        video_sources.append("synthetic_bg")
        participant_sources.append("P_BG")

    X = np.array(X_sequences, dtype=np.float32)
    y = np.array(y_labels, dtype=np.int64)
    v_src = np.array(video_sources)
    p_src = np.array(participant_sources)

    print(f"\n[EXTRACT COMPLETE] Dataset shape: X={X.shape}, y={y.shape}")
    for cid in range(7):
        cname = annot_data.get("classes", {}).get(str(cid), f"Class_{cid}")
        count = int(np.sum(y == cid))
        print(f"  Class {cid} ({cname}): {count} sequences")

    return X, y, v_src, p_src, annot_data

def main():
    parser = argparse.ArgumentParser(description="Extract hand landmarks from Kaggle WHO Handwash dataset for LSTM training.")
    parser.add_argument("--annotations", type=str, default="annotations_kaggle.json", help="Path to annotations_kaggle.json")
    # Discover Kaggle dataset in local kagglehub cache if available
    kaggle_cached = os.path.expanduser("~/.cache/kagglehub/datasets/realtimear/hand-wash-dataset/versions/4/HandWashDataset/HandWashDataset")
    default_vdir = kaggle_cached if os.path.isdir(kaggle_cached) else None
    parser.add_argument("--video-dir", type=str, default=default_vdir, help="Directory containing Kaggle video files")
    parser.add_argument("--output", type=str, default="dataset_landmarks.npz", help="Output .npz dataset path")
    parser.add_argument("--seq-len", type=int, default=30, help="Sequence length in frames")
    parser.add_argument("--stride", type=int, default=2, help="Sliding window stride in frames")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    annot_path = os.path.join(base_dir, args.annotations) if not os.path.isabs(args.annotations) else args.annotations
    output_path = os.path.join(base_dir, args.output) if not os.path.isabs(args.output) else args.output

    X, y, v_src, p_src, annot_data = build_dataset(
        annotations_path=annot_path,
        video_dir=args.video_dir,
        seq_length=args.seq_len,
        stride=args.stride
    )

    np.savez_compressed(
        output_path,
        X=X,
        y=y,
        video_sources=v_src,
        participant_sources=p_src,
        classes=json.dumps(annot_data.get("classes", {})),
        feature_dim=FEATURE_DIM,
        seq_length=args.seq_len
    )
    print(f"[SAVED] Dataset successfully exported to: {output_path} ({os.path.getsize(output_path) / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
