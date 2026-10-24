"""
Tests the FastAPI backend WebSocket endpoint with real video frames to simulate live webcam streaming.
"""
import sys
import os
import time
import cv2
import json
import asyncio
import websockets

async def test_kiosk_stream():
    uri = "ws://localhost:4550/ws_model"
    sample_video = r"C:\Users\jobiy\.cache\kagglehub\datasets\realtimear\hand-wash-dataset\versions\4\HandWashDataset\HandWashDataset\Step_1\HandWash_001_A_01_G01.mp4"
    
    print(f"[TEST CLIENT] Connecting to FastAPI WebSocket: {uri}...")
    cap = cv2.VideoCapture(sample_video)
    
    try:
        async with websockets.connect(uri) as ws:
            print("[TEST CLIENT] Connected! Streaming 35 frames...")
            responses = []
            
            for i in range(35):
                ret, frame = cap.read()
                if not ret:
                    break
                _, jpeg_buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                await ws.send(jpeg_buf.tobytes())
                
                resp = await ws.recv()
                data = json.loads(resp)
                responses.append(data)
                
            print(f"[TEST CLIENT] Received {len(responses)} live WebSocket responses.")
            last_resp = responses[-1]
            print(f"[TEST CLIENT] Sample response at frame 35:")
            print(json.dumps(last_resp, indent=2))
            
            pred = last_resp.get("prediction", {})
            assert pred.get("class") == "Step_1", f"Expected Step_1, got {pred.get('class')}"
            assert pred.get("confidence") > 0.85, f"Confidence too low: {pred.get('confidence')}"
            print("[TEST CLIENT] PASS: Live webcam WebSocket streaming verified successfully!")
    finally:
        cap.release()

if __name__ == "__main__":
    asyncio.run(test_kiosk_stream())
