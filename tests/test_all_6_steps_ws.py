import asyncio
import json
import os
import cv2
import websockets

WS_URL = "ws://localhost:4550/ws_model"
HANDWASHING_DIR = r"c:\Users\jobiy\Downloads\smart-wash-main\Handwashing"

async def test_all_6_steps():
    print(f"\n[TEST] Connecting to {WS_URL} for all 6 steps...")
    async with websockets.connect(WS_URL) as ws:
        for step in range(1, 7):
            video_path = os.path.join(HANDWASHING_DIR, f"{step}.mp4")
            cap = cv2.VideoCapture(video_path)
            assert cap.isOpened(), f"Cannot open video {video_path}"
            
            # Skip first 15 frames to get past any startup stillness
            cap.set(cv2.CAP_PROP_POS_FRAMES, 15)
            predictions = []
            
            # Stream 35 frames per step
            for f in range(35):
                ret, frame = cap.read()
                if not ret:
                    break
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                await ws.send(buffer.tobytes())
                
                resp_raw = await ws.recv()
                resp = json.loads(resp_raw)
                predictions.append(resp['prediction'])
            
            cap.release()
            
            last_pred = predictions[-1] if predictions else {}
            # Count classes in last 15 frames
            recent_classes = [p.get('class') for p in predictions[-15:] if 'class' in p]
            dominant = max(set(recent_classes), key=recent_classes.count) if recent_classes else 'none'
            print(f"Step {step} video ({step}.mp4) -> Last Pred: class={last_pred.get('class')}, conf={last_pred.get('confidence', 0):.2f}, status={last_pred.get('status')}, hands={last_pred.get('hand_count')}, moving={last_pred.get('is_moving')} | Dominant recent: {dominant}")

if __name__ == "__main__":
    asyncio.run(test_all_6_steps())
