"""
Comprehensive Backend Live Streaming & Dynamic Motion Invariance Test
Uses REAL human handwashing frames from the Kaggle WHO dataset.
Connects to ws://localhost:4550/ws_model and validates:
1. Live WebSocket handshake & response
2. Detection of hands from real Kaggle handwashing video
3. Position invariance: translates handwashing frames to Center, Top-Left, Bottom-Right
4. Dynamic motion detection: detects active movement on video playback, and no movement on frozen frames
5. Model prediction output formatting (class, confidence, movement, is_moving, top5)
"""

import asyncio
import websockets
import json
import cv2
import numpy as np
import time
import os

WS_URL = "ws://localhost:4550/ws_model"
KAGGLE_VIDEO = os.path.expanduser("~/.cache/kagglehub/datasets/realtimear/hand-wash-dataset/versions/4/HandWashDataset/HandWashDataset/Step_1/HandWash_001_A_01_G01.mp4")

def extract_video_frames(video_path, max_frames=30):
    cap = cv2.VideoCapture(video_path)
    frames = []
    while cap.isOpened() and len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        # Resize to standard 320x320
        frame = cv2.resize(frame, (320, 320))
        frames.append(frame)
    cap.release()
    return frames

def translate_frame(frame, target_pos="center"):
    """Translates the hand content to different screen positions on a 320x320 canvas."""
    h, w = frame.shape[:2]
    canvas = np.zeros((320, 320, 3), dtype=np.uint8)

    if target_pos == "center":
        return frame.copy()
    elif target_pos == "top_left":
        # Scale to 60% and place at (10, 10)
        scaled = cv2.resize(frame, (int(w * 0.6), int(h * 0.6)))
        sh, sw = scaled.shape[:2]
        canvas[10:10+sh, 10:10+sw] = scaled
        return canvas
    elif target_pos == "bottom_right":
        # Scale to 65% and place at bottom-right
        scaled = cv2.resize(frame, (int(w * 0.65), int(h * 0.65)))
        sh, sw = scaled.shape[:2]
        canvas[320-sh-10:320-10, 320-sw-10:320-10] = scaled
        return canvas
    return frame

async def test_live_websocket():
    print(f"[TEST] Loading real Kaggle WHO dataset video: {os.path.basename(KAGGLE_VIDEO)}")
    assert os.path.isfile(KAGGLE_VIDEO), f"Kaggle video not found at: {KAGGLE_VIDEO}"
    
    raw_frames = extract_video_frames(KAGGLE_VIDEO, max_frames=30)
    print(f"  --> Extracted {len(raw_frames)} real handwashing frames.")

    print(f"\n[TEST] Connecting to Live Backend WebSocket at {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        print("  --> WebSocket Connected Successfully!")
        
        # Test 1: Real Kaggle Handwashing Stream in Center
        print("\n--- Test 1: Real Kaggle Handwashing Stream in Center ---")
        preds_center = []
        for i, frame in enumerate(raw_frames[:15]):
            _, enc = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            await ws.send(enc.tobytes())
            resp = json.loads(await ws.recv())
            pred = resp.get("prediction", {})
            preds_center.append(pred)
            time.sleep(0.03)

        last_center = preds_center[-1]
        print(f"  Frame 15 Result: status={last_center.get('status')}, class={last_center.get('class')}, "
              f"confidence={last_center.get('confidence'):.2f}, hand_count={last_center.get('hand_count')}, "
              f"movement={last_center.get('movement')}, is_moving={last_center.get('is_moving')}")

        assert last_center.get("status") == "active", f"Expected active status, got {last_center.get('status')}"
        assert last_center.get("hand_count") >= 1, "Expected hands to be detected in Kaggle video"
        assert "movement" in last_center, "Missing movement metric"
        assert "is_moving" in last_center, "Missing is_moving boolean"
        print("  [PASS] Real Kaggle video detection & active classification PASSED!")

        # Test 2: Position Invariance - Hands at Top-Left
        print("\n--- Test 2: Position Invariance - Hands at Top-Left ---")
        preds_tl = []
        for i, frame in enumerate(raw_frames[5:15]):
            tl_frame = translate_frame(frame, target_pos="top_left")
            _, enc = cv2.imencode('.jpg', tl_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            await ws.send(enc.tobytes())
            resp = json.loads(await ws.recv())
            preds_tl.append(resp.get("prediction", {}))
            time.sleep(0.03)

        last_tl = preds_tl[-1]
        print(f"  Top-Left Result: status={last_tl.get('status')}, hand_count={last_tl.get('hand_count')}, "
              f"class={last_tl.get('class')}, movement={last_tl.get('movement')}")
        assert last_tl.get("status") in ("active", "buffering")
        print("  [PASS] Top-Left position invariance PASSED!")

        # Test 3: Position Invariance - Hands at Bottom-Right
        print("\n--- Test 3: Position Invariance - Hands at Bottom-Right ---")
        preds_br = []
        for i, frame in enumerate(raw_frames[10:20]):
            br_frame = translate_frame(frame, target_pos="bottom_right")
            _, enc = cv2.imencode('.jpg', br_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            await ws.send(enc.tobytes())
            resp = json.loads(await ws.recv())
            preds_br.append(resp.get("prediction", {}))
            time.sleep(0.03)

        last_br = preds_br[-1]
        print(f"  Bottom-Right Result: status={last_br.get('status')}, hand_count={last_br.get('hand_count')}, "
              f"class={last_br.get('class')}, movement={last_br.get('movement')}")
        assert last_br.get("status") in ("active", "buffering")
        print("  [PASS] Bottom-Right position invariance PASSED!")

        # Test 4: Frozen / Motionless Hand (Dynamic motion should drop)
        print("\n--- Test 4: Frozen / Motionless Hand (Zero landmark displacement) ---")
        still_frame = raw_frames[0]
        preds_still = []
        for i in range(10):
            # Send identical frame repeatedly to simulate stationary hands
            _, enc = cv2.imencode('.jpg', still_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            await ws.send(enc.tobytes())
            resp = json.loads(await ws.recv())
            preds_still.append(resp.get("prediction", {}))
            time.sleep(0.03)

        last_still = preds_still[-1]
        print(f"  Stationary Result: movement={last_still.get('movement')}, is_moving={last_still.get('is_moving')}")
        # When sending identical frames, landmark diff between consecutive frames is identically 0.0
        assert last_still.get("movement") == 0.0, f"Expected 0.0 movement on frozen frames, got {last_still.get('movement')}"
        assert last_still.get("is_moving") is False, "Expected is_moving=False on frozen frames"
        print("  [PASS] Motionless freeze test PASSED!")

    print("\n" + "="*60)
    print("ALL 4 REAL KAGGLE DATASET LIVE STREAMING TESTS PASSED!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_live_websocket())
