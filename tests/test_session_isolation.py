"""
SMART WASH — Session Isolation Test for MediaPipe + LSTM Engine
Verifies that concurrent WebSocket connections maintain separate rolling buffers
with zero cross-session data leakage.
"""

import asyncio
import json
import cv2
import websockets

WS_URL = "ws://localhost:4550/ws_model"
VIDEO_STEP1 = r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing\1.mp4"
VIDEO_STEP2 = r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing\2.mp4"

async def stream_client(client_id, video_path, expected_class, results_dict):
    print(f"[{client_id}] Connecting to {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        cap = cv2.VideoCapture(video_path)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 40)

        preds = []
        for i in range(35):
            ret, frame = cap.read()
            if not ret:
                break
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            await ws.send(buffer.tobytes())

            resp_raw = await ws.recv()
            resp = json.loads(resp_raw)
            preds.append(resp["prediction"])

        cap.release()
        results_dict[client_id] = preds[-1]
        print(f"[{client_id}] Finished streaming. Final prediction: {preds[-1]['class']} ({preds[-1]['confidence']:.2f})")

async def test_concurrent_sessions():
    results = {}
    print("\n[ISOLATION TEST] Launching concurrent Client A (Step 1) and Client B (Step 2)...")
    task_a = stream_client("Client_A", VIDEO_STEP1, "Step_1", results)
    task_b = stream_client("Client_B", VIDEO_STEP2, "Step_2", results)

    await asyncio.gather(task_a, task_b)

    assert "Client_A" in results, "Client A result missing"
    assert "Client_B" in results, "Client B result missing"

    assert results["Client_A"]["class"] == "Step_1", f"Client A should be Step_1, got {results['Client_A']['class']}"
    assert results["Client_A"]["confidence"] >= 0.70

    assert results["Client_B"]["class"] == "Step_2", f"Client B should be Step_2, got {results['Client_B']['class']}"
    assert results["Client_B"]["confidence"] >= 0.70

    print("[ISOLATION TEST PASSED] Sessions are strictly isolated with independent sequence buffers!")

if __name__ == "__main__":
    asyncio.run(test_concurrent_sessions())
