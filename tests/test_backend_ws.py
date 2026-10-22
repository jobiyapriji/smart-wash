import asyncio
import websockets
import json
import cv2
import numpy as np
import base64

async def test_websocket_dual_protocol():
    uri = "ws://localhost:4550/ws_model"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # Create a synthetic 320x320 test frame
        dummy = np.zeros((320, 320, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', dummy)
        raw_bytes = buf.tobytes()

        # 1. Test Binary Transmission
        print("Testing binary JPEG frame transmission...")
        await ws.send(raw_bytes)
        response_raw = await ws.recv()
        resp = json.loads(response_raw)
        print("Binary response received:", resp["prediction"]["class"], "conf:", resp["prediction"]["confidence"])
        assert "prediction" in resp, "Missing prediction in binary response"

        # 2. Test Base64 Text Transmission
        print("Testing Base64 text frame transmission...")
        b64_str = "data:image/jpeg;base64," + base64.b64encode(raw_bytes).decode('utf-8')
        await ws.send(b64_str)
        response_text = await ws.recv()
        resp2 = json.loads(response_text)
        print("Base64 response received:", resp2["prediction"]["class"], "conf:", resp2["prediction"]["confidence"])
        assert "prediction" in resp2, "Missing prediction in text response"

        print("ALL BACKEND WS DUAL-PROTOCOL TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_websocket_dual_protocol())
