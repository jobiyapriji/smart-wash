"""
SMART WASH — MediaPipe + PyTorch LSTM Live Inference Engine
Author: SMART WASH AI Pipeline

Provides:
1. LSTMHandwashClassifier: Model & MediaPipe loader with identical preprocessing
   to the training pipeline (canonical hand slots, wrist-centering, palm scale normalization).
2. SessionLandmarkBuffer: Per-student rolling temporal buffer (maxlen=30) ensuring
   strict session isolation without memory or buffer leakage.
"""

import os
import json
import logging
from collections import deque
import numpy as np
import cv2
import torch
import torch.nn as nn
import mediapipe as mp

logger = logging.getLogger("smartwash-lstm-engine")

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

FEATURE_DIM = 126
HAND_FEATURE_DIM = 63
SEQUENCE_LENGTH = 30

class HandwashLSTM(nn.Module):
    def __init__(self, input_size=126, hidden_size=64, num_layers=2, num_classes=7, dropout=0.2):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc1 = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(32, num_classes)

    def forward(self, x):
        out, (hn, cn) = self.lstm(x)
        last_step = out[:, -1, :]
        h = self.relu(self.fc1(last_step))
        h = self.dropout(h)
        logits = self.fc2(h)
        return logits

class LSTMHandwashClassifier:
    """
    Centralized Model & MediaPipe Service loaded once on application startup.
    """
    def __init__(self, model_dir=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if model_dir is None:
            model_dir = os.path.join(base_dir, "models", "lstm")

        weights_path = os.path.join(model_dir, "handwash_lstm.pt")
        config_path = os.path.join(model_dir, "config.json")
        mediapipe_task_path = os.path.join(base_dir, "models", "mediapipe", "hand_landmarker.task")

        if not os.path.exists(weights_path) or not os.path.exists(config_path):
            raise FileNotFoundError(f"Missing LSTM model weights or config in {model_dir}")

        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

        self.classes = {int(k): v for k, v in self.config.get("classes", {}).items()}
        self.num_classes = len(self.classes)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize PyTorch Model
        self.model = HandwashLSTM(
            input_size=self.config.get("input_size", FEATURE_DIM),
            hidden_size=self.config.get("hidden_size", 64),
            num_layers=self.config.get("num_layers", 2),
            num_classes=self.num_classes,
            dropout=0.0
        ).to(self.device)

        self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        self.model.eval()
        self.model_loaded = True
        logger.info(f"Loaded HandwashLSTM model on {self.device.type.upper()} ({self.num_classes} classes)")

        # Initialize MediaPipe Tasks HandLandmarker
        if not os.path.exists(mediapipe_task_path):
            raise FileNotFoundError(f"MediaPipe task asset missing at {mediapipe_task_path}")

        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=mediapipe_task_path),
            running_mode=VisionRunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.3,
            min_hand_presence_confidence=0.3,
            min_tracking_confidence=0.3
        )
        self.landmarker = HandLandmarker.create_from_options(options)
        logger.info("MediaPipe HandLandmarker initialized successfully.")

    @staticmethod
    def normalize_single_hand(landmarks_21):
        pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks_21], dtype=np.float32)
        wrist = pts[0]
        translated = pts - wrist
        middle_mcp = translated[9]
        scale = np.linalg.norm(middle_mcp)
        if scale > 1e-5:
            normalized = translated / scale
        else:
            normalized = translated
        return normalized.flatten()

    def extract_features(self, frame_bgr):
        """
        Extracts 126-dimensional canonical landmark feature vector from an OpenCV BGR frame.
        Identical to the training pipeline.
        """
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = self.landmarker.detect(mp_img)

        feat = np.zeros(FEATURE_DIM, dtype=np.float32)
        num_hands = len(res.hand_landmarks) if res.hand_landmarks else 0
        avg_conf = 0.0

        if num_hands == 0:
            return feat, 0, 0.0

        if num_hands == 1:
            label = res.handedness[0][0].category_name if res.handedness else "Right"
            avg_conf = float(res.handedness[0][0].score) if res.handedness else 0.8
            hand_norm = self.normalize_single_hand(res.hand_landmarks[0])
            if label.lower() == "left":
                feat[0:HAND_FEATURE_DIM] = hand_norm
            else:
                feat[HAND_FEATURE_DIM:FEATURE_DIM] = hand_norm
        else:
            h0_label = res.handedness[0][0].category_name.lower() if res.handedness else "left"
            h1_label = res.handedness[1][0].category_name.lower() if len(res.handedness) > 1 else "right"
            s0 = float(res.handedness[0][0].score) if res.handedness else 0.8
            s1 = float(res.handedness[1][0].score) if len(res.handedness) > 1 else 0.8
            avg_conf = (s0 + s1) / 2.0

            h0_norm = self.normalize_single_hand(res.hand_landmarks[0])
            h1_norm = self.normalize_single_hand(res.hand_landmarks[1])

            if h0_label == "left" and h1_label == "right":
                feat[0:HAND_FEATURE_DIM] = h0_norm
                feat[HAND_FEATURE_DIM:FEATURE_DIM] = h1_norm
            elif h0_label == "right" and h1_label == "left":
                feat[0:HAND_FEATURE_DIM] = h1_norm
                feat[HAND_FEATURE_DIM:FEATURE_DIM] = h0_norm
            else:
                x0 = res.hand_landmarks[0][0].x
                x1 = res.hand_landmarks[1][0].x
                if x0 < x1:
                    feat[0:HAND_FEATURE_DIM] = h0_norm
                    feat[HAND_FEATURE_DIM:FEATURE_DIM] = h1_norm
                else:
                    feat[0:HAND_FEATURE_DIM] = h1_norm
                    feat[HAND_FEATURE_DIM:FEATURE_DIM] = h0_norm

        return feat, num_hands, avg_conf

    def predict_sequence(self, sequence_tensor_np):
        """
        Runs LSTM inference on a (1, 30, 126) sequence tensor.
        """
        tensor = torch.from_numpy(sequence_tensor_np).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

        top_idx = int(np.argmax(probs))
        top_conf = float(probs[top_idx])
        top_class = self.classes.get(top_idx, "background")

        # Top 5 distribution
        top5_indices = np.argsort(probs)[::-1][:5]
        top5_dict = {self.classes.get(int(idx), f"Class_{idx}"): float(probs[idx]) for idx in top5_indices}

        return top_class, top_conf, top5_dict

    def close(self):
        if hasattr(self, "landmarker") and self.landmarker:
            self.landmarker.close()


class SessionLandmarkBuffer:
    """
    Dedicated session-specific temporal sequence buffer.
    Maintains rolling 30-frame window per active kiosk connection.
    Guarantees zero cross-student leakage.
    """
    def __init__(self, classifier: LSTMHandwashClassifier, maxlen=SEQUENCE_LENGTH):
        self.classifier = classifier
        self.maxlen = maxlen
        self.buffer = deque(maxlen=maxlen)
        self.missing_hands_streak = 0
        self.last_valid_prediction = {"class": "background", "confidence": 1.0, "top5": {}}

    def reset(self):
        self.buffer.clear()
        self.missing_hands_streak = 0
        self.last_valid_prediction = {"class": "background", "confidence": 1.0, "top5": {}}

    def process_frame(self, frame_bgr):
        """
        Processes a single incoming video frame:
        1. MediaPipe landmark extraction & canonical normalization.
        2. Rolling sequence buffer update.
        3. LSTM forward pass once buffer is populated.
        4. Returns prediction dictionary matching WebSocket contract.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return {
                "class": "background",
                "confidence": 1.0,
                "status": "invalid_frame",
                "top5": {"background": 1.0}
            }

        feat, num_hands, hand_conf = self.classifier.extract_features(frame_bgr)

        if num_hands == 0:
            self.missing_hands_streak += 1
            # Append zero feature to avoid sudden sequence starvation
            self.buffer.append(feat)
            if self.missing_hands_streak >= 10:  # ~300ms at 30fps
                return {
                    "class": "background",
                    "confidence": 1.0,
                    "status": "missing_hands",
                    "hand_count": 0,
                    "top5": {"background": 1.0}
                }
        else:
            self.missing_hands_streak = 0
            self.buffer.append(feat)

        # Fast Warm-Up: If we have at least 5 frames, tile/resample to 30 frames
        # so inference starts immediately within < 150ms instead of waiting 1-2 seconds!
        if len(self.buffer) < 5:
            return {
                "class": "background",
                "confidence": 0.50,
                "status": "buffering",
                "buffered_frames": len(self.buffer),
                "required_frames": 5,
                "hand_count": num_hands,
                "top5": {"background": 0.50}
            }

        # Resample buffer to 30 frames during initial warm-up (frames 5 to 29)
        if len(self.buffer) < self.maxlen:
            buf_list = list(self.buffer)
            indices = np.linspace(0, len(buf_list) - 1, self.maxlen).astype(int)
            seq_array = np.array([buf_list[idx] for idx in indices], dtype=np.float32)
        else:
            seq_array = np.array(self.buffer, dtype=np.float32)

        pred_class, pred_conf, top5 = self.classifier.predict_sequence(seq_array)

        result = {
            "class": pred_class,
            "confidence": pred_conf,
            "status": "active",
            "hand_count": num_hands,
            "hand_confidence": hand_conf,
            "top5": top5
        }
        self.last_valid_prediction = result
        return result

