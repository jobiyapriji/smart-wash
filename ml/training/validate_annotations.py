"""
SMART WASH — Dataset Annotation Validator
Author: SMART WASH AI Pipeline

Validates annotations.json against physical video files:
- Checks JSON schema, classes, timestamps, and files existence.
- Verifies readability and FPS/frame counts via OpenCV.
- Flags corrupted videos, out-of-bound timestamps, and unannotated segments.
- Generates template annotations if video files are added without annotations.
"""

import os
import sys
import json
import argparse
import cv2

def validate_dataset(annotations_path, video_dir=None):
    if not os.path.exists(annotations_path):
        print(f"[ERROR] Annotations file not found: {annotations_path}")
        return False

    with open(annotations_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid JSON syntax in {annotations_path}: {e}")
            return False

    classes = data.get("classes", {})
    if not classes:
        print("[ERROR] No 'classes' definition found in annotations.")
        return False

    print(f"[INFO] Defined classes: {classes}")

    if video_dir is None:
        configured_dir = data.get("default_video_dir", "../../../Handwashing")
        base_dir = os.path.dirname(os.path.abspath(annotations_path))
        candidates = [
            os.path.normpath(os.path.join(base_dir, configured_dir)),
            os.path.normpath(os.path.join(base_dir, "../../../Handwashing")),
            os.path.normpath(os.path.join(base_dir, "../../Handwashing")),
            os.path.normpath(os.path.join(base_dir, "../Handwashing")),
            os.path.normpath(os.path.join(base_dir, "./Handwashing")),
            r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing"
        ]
        video_dir = next((c for c in candidates if os.path.exists(c)), candidates[0])

    print(f"[INFO] Checking videos in directory: {video_dir}")
    if not os.path.exists(video_dir):
        print(f"[ERROR] Video directory does not exist: {video_dir}")
        return False

    videos = data.get("videos", [])
    if not videos:
        print("[ERROR] No videos listed in annotations.")
        return False

    all_valid = True
    total_annotated_duration = 0.0

    for idx, vinfo in enumerate(videos):
        fn = vinfo.get("filename")
        if not fn:
            print(f"[ERROR] Video #{idx} missing 'filename'.")
            all_valid = False
            continue

        video_path = os.path.join(video_dir, fn)
        if not os.path.exists(video_path):
            print(f"[ERROR] Video file missing: {video_path}")
            all_valid = False
            continue

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[ERROR] Cannot open video file with OpenCV: {video_path}")
            all_valid = False
            continue

        actual_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()

        if actual_fps <= 0 or actual_frames <= 0:
            print(f"[ERROR] Invalid stream properties for {fn}: {actual_frames} frames, {actual_fps} fps")
            all_valid = False
            continue

        duration = actual_frames / actual_fps
        print(f"[OK] {fn}: {actual_frames} frames, {actual_fps:.2f} fps, duration={duration:.2f}s")

        segments = vinfo.get("segments", [])
        if not segments:
            print(f"[WARNING] Video {fn} has no annotated action segments.")

        for seg_idx, seg in enumerate(segments):
            action = seg.get("action")
            class_id = seg.get("class_id")
            start_sec = seg.get("start_sec", 0.0)
            end_sec = seg.get("end_sec", duration)

            if str(class_id) not in classes and class_id not in classes.values():
                print(f"[ERROR] {fn} segment #{seg_idx} has unknown class_id: {class_id}")
                all_valid = False

            if start_sec < 0 or start_sec >= duration:
                print(f"[ERROR] {fn} segment #{seg_idx} start_sec ({start_sec}s) out of bounds [0, {duration:.2f}s]")
                all_valid = False

            if end_sec <= start_sec or end_sec > duration + 0.1:
                print(f"[ERROR] {fn} segment #{seg_idx} end_sec ({end_sec}s) invalid for duration {duration:.2f}s")
                all_valid = False

            seg_len = end_sec - start_sec
            total_annotated_duration += seg_len
            print(f"     Segment #{seg_idx}: {action} (Class {class_id}) [{start_sec:.1f}s -> {end_sec:.1f}s, len={seg_len:.1f}s]")

    if all_valid:
        print(f"[SUCCESS] All {len(videos)} videos and segments are valid! Total annotated duration: {total_annotated_duration:.2f}s.")
    else:
        print("[FAIL] Validation errors found. Please inspect output above.")

    return all_valid

def generate_template(video_dir, output_path):
    """Generates an annotation template for all mp4 videos found in video_dir."""
    if not os.path.exists(video_dir):
        print(f"[ERROR] Video directory not found: {video_dir}")
        return

    mp4_files = [f for f in os.listdir(video_dir) if f.lower().endswith(".mp4")]
    template = {
        "dataset_version": "1.0",
        "dataset_name": "SMART WASH Template Annotations",
        "classes": {
            "0": "background",
            "1": "Step_1",
            "2": "Step_2",
            "3": "Step_3",
            "4": "Step_4",
            "5": "Step_5",
            "6": "Step_6"
        },
        "default_video_dir": os.path.relpath(video_dir, os.path.dirname(output_path)),
        "videos": []
    }

    for fn in sorted(mp4_files):
        cap = cv2.VideoCapture(os.path.join(video_dir, fn))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if cap.isOpened() else 0
        fps = cap.get(cv2.CAP_PROP_FPS) if cap.isOpened() else 30.0
        cap.release()
        dur = total_frames / fps if fps > 0 else 10.0

        template["videos"].append({
            "filename": fn,
            "participant_id": "P1",
            "fps": fps,
            "total_frames": total_frames,
            "segments": [
                {
                    "action": "Step_1",
                    "class_id": 1,
                    "start_sec": 0.5,
                    "end_sec": round(dur - 0.5, 1)
                }
            ]
        })

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(template, f, indent=2)
    print(f"[INFO] Template generated with {len(mp4_files)} videos at: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Validate SMART WASH dataset annotations.")
    parser.add_argument("--annotations", type=str, default="annotations.json", help="Path to annotations.json")
    parser.add_argument("--video-dir", type=str, default=None, help="Directory containing video files")
    parser.add_argument("--make-template", action="store_true", help="Generate annotation template")
    parser.add_argument("--template-out", type=str, default="annotations_template.json", help="Template output path")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    annot_path = os.path.join(base_dir, args.annotations) if not os.path.isabs(args.annotations) else args.annotations

    if args.make_template:
        vdir = args.video_dir or os.path.normpath(os.path.join(base_dir, "../../Handwashing"))
        generate_template(vdir, os.path.join(base_dir, args.template_out))
    else:
        success = validate_dataset(annot_path, args.video_dir)
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
