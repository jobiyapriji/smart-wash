"""
SMART WASH — WebSocket Integration Test for MediaPipe + LSTM Engine
Tests live WebSocket frame streaming against ws://localhost:4550/ws_model
"""

import asyncio
import json
import os
import cv2
import websockets

WS_URL = "ws://localhost:4550/ws_model"
VIDEO_PATH = r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing\1.mp4"

async def test_websocket_stream_recognition():
    print(f"\n[TEST] Connecting to {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        cap = cv2.VideoCapture(VIDEO_PATH)
        assert cap.isOpened(), f"Cannot open video at {VIDEO_PATH}"
        cap.set(cv2.CAP_PROP_POS_FRAMES, 30)

        predictions = []
        for i in range(35):
            ret, frame = cap.read()
            if not ret:
                break

            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            await ws.send(buffer.tobytes())

            resp_raw = await ws.recv()
            resp = json.loads(resp_raw)
            predictions.append(resp)

        cap.release()

        assert len(predictions) == 35, f"Expected 35 responses, got {len(predictions)}"
        print(f"[TEST] Received {len(predictions)} frames.")

        # First frames should show buffering
        assert predictions[0]["prediction"]["status"] == "buffering"
        print("[TEST] Frame 1 correctly flagged as 'buffering'.")

        # By frame 35 (buffer full), should recognize Step_1
        last_pred = predictions[-1]["prediction"]
        print(f"[TEST] Frame 35 prediction: class={last_pred['class']}, conf={last_pred['confidence']:.2f}, status={last_pred['status']}")
        assert last_pred["class"] == "Step_1", f"Expected Step_1, got {last_pred['class']}"
        assert last_pred["confidence"] >= 0.70, f"Expected confidence >= 0.70, got {last_pred['confidence']}"
        assert last_pred["status"] == "active"
        print("[TEST] Step_1 recognition successfully verified over live WebSocket!")

if __name__ == "__main__":
    asyncio.run(test_websocket_stream_recognition())
