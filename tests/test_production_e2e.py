"""
SMART WASH — Production End-to-End System Integration Test
Validates:
1. HTTP Liveness probe (/health)
2. HTTP Readiness probe (/ready with model metadata & device)
3. WebSocket Dual-Protocol Ingestion (Binary Bytes + Base64 JSON)
4. Concurrency & Latency benchmarks
"""

import urllib.request
import json
import time
import asyncio
import websockets
import numpy as np
import cv2
import base64
import sys

BASE_URL = "http://localhost:4550"
WS_URL = "ws://localhost:4550/ws_model"

def test_http_probes():
    print("--- 1. Testing HTTP Health & Readiness Probes ---")
    
    # Root
    with urllib.request.urlopen(f"{BASE_URL}/") as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        print("[OK] Root endpoint:", data)
        assert data.get("status") == "online"

    # Health
    with urllib.request.urlopen(f"{BASE_URL}/health") as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        print("[OK] Health probe:", data)
        assert data.get("status") == "healthy"
        assert "uptime_seconds" in data

    # Ready
    with urllib.request.urlopen(f"{BASE_URL}/ready") as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        print("[OK] Readiness probe:", data)
        assert data.get("status") == "ready"
        assert data.get("device") in ["cpu", "cuda", "mps", "unknown"]
        assert len(data.get("classes", {})) > 0

async def test_websocket_streaming():
    print("\n--- 2. Testing WebSocket AI Step Inference Pipeline ---")
    
    # Create test 320x320 frame
    frame = np.zeros((320, 320, 3), dtype=np.uint8)
    # Draw simple shapes to simulate hand structure
    cv2.circle(frame, (160, 160), 60, (200, 200, 200), -1)
    _, encoded_jpg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
    raw_bytes = encoded_jpg.tobytes()

    async with websockets.connect(WS_URL) as ws:
        # A. Binary frame
        t0 = time.perf_counter()
        await ws.send(raw_bytes)
        res_binary = await ws.recv()
        latency_binary_ms = (time.perf_counter() - t0) * 1000
        data_binary = json.loads(res_binary)
        
        print(f"[OK] Binary frame processed in {latency_binary_ms:.2f}ms")
        print("  Prediction:", data_binary.get("prediction"))
        assert "prediction" in data_binary
        assert "class" in data_binary["prediction"]
        assert "confidence" in data_binary["prediction"]

        # B. Base64 frame
        t0 = time.perf_counter()
        b64_str = "data:image/jpeg;base64," + base64.b64encode(raw_bytes).decode('utf-8')
        await ws.send(b64_str)
        res_text = await ws.recv()
        latency_text_ms = (time.perf_counter() - t0) * 1000
        data_text = json.loads(res_text)

        print(f"[OK] Base64 frame processed in {latency_text_ms:.2f}ms")
        print("  Prediction:", data_text.get("prediction"))
        assert "prediction" in data_text
        assert "class" in data_text["prediction"]

    print("\n--- 3. Testing High-Throughput Burst Ingestion ---")
    async with websockets.connect(WS_URL) as ws:
        latencies = []
        for i in range(10):
            t_start = time.perf_counter()
            await ws.send(raw_bytes)
            msg = await ws.recv()
            latencies.append((time.perf_counter() - t_start) * 1000)

        avg_lat = sum(latencies) / len(latencies)
        print(f"[OK] Streamed 10 consecutive frames: avg latency = {avg_lat:.2f}ms, min = {min(latencies):.2f}ms, max = {max(latencies):.2f}ms")
        assert avg_lat < 200, f"Average latency too high: {avg_lat}ms"

def run_all():
    try:
        test_http_probes()
        asyncio.run(test_websocket_streaming())
        print("\n=======================================================")
        print("[SUCCESS] ALL PRODUCTION INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("=======================================================")
        return 0
    except Exception as e:
        print(f"\n[FAIL] Production integration test failed: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(run_all())
