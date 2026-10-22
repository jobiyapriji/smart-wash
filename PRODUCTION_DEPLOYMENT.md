# SMART WASH — Production Architecture & Deployment Guide
**Lead Software Engineer & System Architecture Specification**

---

## 🏛️ 1. System Architecture

SMART WASH is an autonomous, touchless handwashing compliance kiosk engineered for school environments. It operates in an **On-Premise School Server with Docker Compose** topology, providing low latency, air-gapped offline capability, and real-time AI computer vision.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               School Network (LAN / Wi-Fi)              │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                          HTTP / WS Port 80 / 3000 (Reverse Proxy)
                                                ▼
         ┌───────────────────────────────────────────────────────────────────────────┐
         │                    CONTAINER 1: smartwash-frontend                        │
         │                         (Nginx 1.25 Alpine)                               │
         │                                                                           │
         │  • Multi-stage production build (Vite + React 18)                         │
         │  • Aggressive caching: /mediapipe/, /models/, /audio/, /assets/           │
         │  • SPA history fallback (try_files $uri $uri/ /index.html)                │
         │  • Gzip compression level 6 for fast Wi-Fi delivery                       │
         │  • Reverse proxy /ws_model ➔ backend:4550 (WebSocket Upgrade)            │
         │  • Pass-through /health, /ready, /docs ➔ backend:4550                     │
         └──────────────────────────────────────┬────────────────────────────────────┘
                                                │
                                  Internal Docker Bridge Network
                                       ws://backend:4550/ws_model
                                                ▼
         ┌───────────────────────────────────────────────────────────────────────────┐
         │                    CONTAINER 2: smartwash-backend                         │
         │                       (Python 3.10 Slim + FastAPI)                        │
         │                                                                           │
         │  • YOLOv11 Classification Engine (Ultralytics + PyTorch)                  │
         │  • Non-Blocking Inference via Starlette Threadpool Worker Pool            │
         │  • Dual-Protocol Ingestion: Raw Binary JPEG (Blob) + Base64 JSON fallback │
         │  • Unprivileged user container security (UID 1000)                        │
         │  • Container Healthcheck: GET /health (15s interval)                      │
         │  • Readiness Probe: GET /ready (device, classes, uptime)                  │
         └───────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 2. Production Performance & Hardening Features

| Subsystem | Production Engineering Implementation |
| :--- | :--- |
| **Concurrency** | PyTorch YOLO inference is offloaded to `starlette.concurrency.run_in_threadpool`. The asyncio event loop is never blocked, allowing multiple school sink kiosks to stream frames concurrently. |
| **Frame Ingestion** | Uses raw binary JPEG `Blob` payloads over WebSocket (`canvas.toBlob`), cutting bandwidth by ~33% and eliminating Base64 string allocations and V8 garbage-collection spikes. |
| **Dynamic Host Resolution** | Frontend automatically discovers WebSocket host via `getWebSocketEndpoint()`. Works seamlessly whether running on localhost, school server IP (`192.168.x.x`), or behind Nginx on port 80. |
| **Detection Gating** | 5-condition strict crediting (`handsPresent`, `stepMatch`, `confidence >= 0.60`, `movement >= 0.05`, `debounce >= 8`). Palm movement computed exclusively from MediaPipe hand landmarks (eliminating head/body motion artifacts). |
| **Code Splitting** | Vite `rollupOptions.output.manualChunks` splits `vendor-react`, `vendor-faceapi`, and `vendor-mediapipe` into distinct immutable chunks. |
| **Offline First** | MediaPipe wasm/binary files, Face-API models, and multi-language kid audio prompts are hosted locally inside the container image. No internet connection required during operation. |

---

## 🚀 3. Quick Start (Production Deployment)

### Option A: One-Click Launch (Recommended)

#### On Windows:
Double-click `scripts\start_production.bat` or run:
```cmd
scripts\start_production.bat
```

#### On Linux / macOS:
```bash
chmod +x scripts/start_production.sh
./scripts/start_production.sh
```

### Option B: Standard Docker Compose Command
```bash
docker compose up -d --build
```

---

## 🌐 4. Service Endpoints

Once launched, access the system on your school server or kiosk tablets:

| Component | URL | Purpose |
| :--- | :--- | :--- |
| **Kiosk & Dashboard** | `http://<server-ip>:80` | Mode selection, Student Kiosk, Teacher Dashboard |
| **Student Kiosk Direct** | `http://<server-ip>:80/student` | Touchless washing kiosk interface |
| **Teacher Dashboard** | `http://<server-ip>:80/teacher` | Compliance records, class summaries, leaderboards |
| **Liveness Probe** | `http://<server-ip>:4550/health` | Container health monitor (`status: healthy`) |
| **Readiness Probe** | `http://<server-ip>:4550/ready` | Model weights, device (`cpu` / `cuda`), active classes |
| **Swagger API Docs** | `http://<server-ip>:4550/docs` | Interactive FastAPI documentation |

---

## 🧪 5. Verification & Test Suite

SMART WASH includes a full testing pyramid covering unit tests, gating rules, integration tests, and production E2E pipelines:

### 1. Run Complete Unit & Integration Suite (32 Tests)
```bash
npm test
```
*Validates:*
- Model label normalization and Step 7 rejection.
- Temporal debounce and streak gating.
- Palm displacement vector calculation.
- Scoring engine tiers (Superstar, Great job, Good try, Let's try again).
- State machine transitions & timeout cancellations.
- Dynamic WebSocket resolution.
- Trilingual i18n audio prompts.

### 2. Run Production End-to-End Smoke Test
```bash
py tests/test_production_e2e.py
```
*Validates:*
- HTTP `/` online confirmation.
- Liveness probe (`/health`) returns HTTP 200 and uptime.
- Readiness probe (`/ready`) verifies YOLO model is initialized.
- High-performance binary JPEG frame ingestion via WebSocket.
- Base64 text frame ingestion fallback.
- Burst throughput benchmark (10 frames at ~30 FPS average latency).

### 3. Build Production Bundle Check
```bash
npm run build
```
*Validates:*
- Zero syntax errors, clean code-splitting into vendor chunks, tree-shaking verification.

---

## 🖥️ 6. Bare-Metal (Non-Docker) Production Run

If running directly on a host machine without Docker:

```bash
# Terminal 1: Backend AI Service
py -m uvicorn backend.main:app --host 0.0.0.0 --port 4550 --workers 1

# Terminal 2: Production Static File Server
npm run build
npx serve -s dist -l 80
```

---

## 🔧 7. Configuration Reference

Configuration is managed via `.env.production` or system environment variables:

```ini
# Port Configuration
PORT=80
HOST=0.0.0.0

# CORS Configuration (Set to specific kiosk subnets in strict school networks)
CORS_ORIGINS=*

# Optional WebSocket override (Leave blank for automatic reverse-proxy resolution)
# VITE_WS_URL=ws://192.168.1.100:4550/ws_model

# Firebase Production (Optional: leaving empty keeps app in secure local storage mode)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

---

## 🛡️ 8. Security & Operational Hardening Checklist
- [x] **Non-Root Execution**: Backend container runs under unprivileged UID 1000 (`smartwash`).
- [x] **No Ghost Credits**: Strict landmark confidence gating (`>=0.60`) and palm center displacement (`>=0.05`).
- [x] **No Unhandled Socket Crashes**: Clean `WebSocketDisconnect` trapping and connection reaping.
- [x] **Air-Gapped Operation**: 100% self-hosted assets (MediaPipe wasm, Face-API models, child audio guides).
- [x] **Healthchecks Enabled**: Self-healing container restart policies with liveness monitoring.
