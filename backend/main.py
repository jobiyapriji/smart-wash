from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
import asyncio
import cv2
import numpy as np
import base64
import time
import os
import logging

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smartwash-backend")

START_TIME = time.time()

try:
    from .lstm_engine import LSTMHandwashClassifier, SessionLandmarkBuffer
except (ImportError, ValueError):
    from lstm_engine import LSTMHandwashClassifier, SessionLandmarkBuffer

try:
    from .app import inferance
    from .utils.classifier import Classifier
except Exception as e:
    logger.error(f"Failed to import modules: {e}")
    raise

app = FastAPI(
    title="SMART WASH AI Classification Engine",
    description="Low-latency MediaPipe + LSTM handwashing action recognition server for touchless school kiosks",
    version="2.0.0"
)

# Initialize models
logger.info("Initializing MediaPipe + LSTM action recognition engine...")
# Allow optional override of model directory via environment variable for testing/validation
model_dir = os.getenv("SMART_WASH_MODEL_DIR")
try:
    if model_dir:
        lstm_classifier = LSTMHandwashClassifier(model_dir=model_dir)
        logger.info(f"LSTM model loaded from overridden dir {model_dir} on device: {lstm_classifier.device}")
    else:
        lstm_classifier = LSTMHandwashClassifier()
        logger.info(f"LSTM model loaded successfully on device: {lstm_classifier.device}")
except Exception as e:
    logger.warning(f"Failed to load LSTM classifier, falling back to YOLO: {e}")
    lstm_classifier = None

try:
    infr = inferance()
except Exception as e:
    logger.warning(f"Legacy YOLO fallback not loaded: {e}")
    infr = None

allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws_model")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info(f"Kiosk client connected from {client_host}")

    # Maintain a dedicated, isolated rolling sequence buffer for this kiosk connection
    session_buffer = SessionLandmarkBuffer(classifier=lstm_classifier) if lstm_classifier else None

    try:
        while True:
            # Receive raw message supporting both binary JPEG frames and Base64 strings
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                logger.info(f"Kiosk client disconnected gracefully: {client_host}")
                break

            frame = None

            if "bytes" in message and message["bytes"]:
                # High-efficiency binary JPEG buffer
                nparr = np.frombuffer(message["bytes"], np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            elif "text" in message and message["text"]:
                frame_data = message["text"]
                if not frame_data.strip():
                    continue
                # Remove data URL prefix if present
                if ',' in frame_data:
                    _, encoded = frame_data.split(',', 1)
                else:
                    encoded = frame_data
                try:
                    nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as decode_err:
                    logger.warning(f"Failed to decode base64 frame: {decode_err}")
                    continue

            if frame is not None:
                timestamp = time.time() * 1000
                # Offload MediaPipe extraction & PyTorch LSTM inference to Starlette threadpool
                # This guarantees the asyncio event loop is never blocked
                if session_buffer:
                    result = await run_in_threadpool(session_buffer.process_frame, frame)
                elif infr:
                    result = await run_in_threadpool(infr.predict, frame)
                else:
                    result = {"class": "background", "confidence": 1.0, "top5": {}}

                await websocket.send_json({
                    "timestamp": timestamp,
                    "prediction": result
                })
    except WebSocketDisconnect:
        logger.info(f"Kiosk client disconnected gracefully: {client_host}")
    except RuntimeError as re:
        if "disconnect message has been received" in str(re):
            logger.info(f"Kiosk client disconnected: {client_host}")
        else:
            logger.error(f"WebSocket session runtime error for {client_host}: {re}")
    except Exception as e:
        logger.error(f"WebSocket session error for {client_host}: {e}")
    finally:
        if session_buffer:
            session_buffer.reset()
        try:
            await websocket.close()
        except Exception:
            pass

@app.get("/")
async def root():
    return {
        "service": "SMART WASH Classification Engine",
        "engine": "MediaPipe_PyTorch_LSTM" if lstm_classifier else "YOLO_Legacy",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready"
    }

@app.get("/health")
async def health():
    """Liveness probe for Docker / Kubernetes container monitoring."""
    return {
        "status": "healthy",
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "timestamp": time.time()
    }

@app.get("/ready")
async def readiness():
    """Readiness probe verifying model loaded status and execution device."""
    is_ready = bool((lstm_classifier and lstm_classifier.model_loaded) or (infr and getattr(infr, "model_loaded", False)))
    device = str(getattr(lstm_classifier, "device", getattr(infr, "device", "unknown")))
    classes = getattr(lstm_classifier, "classes", getattr(infr, "names", {}))
    return {
        "status": "ready" if is_ready else "not_ready",
        "engine": "MediaPipe_PyTorch_LSTM" if lstm_classifier else "YOLO_Legacy",
        "device": device,
        "classes": classes,
        "uptime_seconds": round(time.time() - START_TIME, 2)
    }


