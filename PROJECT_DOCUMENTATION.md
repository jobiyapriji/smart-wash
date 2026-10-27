# SMART WASH — Technical Project Documentation & Viva Reference Manual

> **Project Title**: SMART WASH — AI-Based Hand Hygiene Monitoring System with Local Language Voice Assistant  
> **Degree**: Bachelor of Technology (B.Tech) in Computer Science & Engineering  
> **System Architecture**: Distributed Edge Client (React 18 + Vite + MediaPipe) + Real-Time Microservice Backend (FastAPI + PyTorch LSTM + MediaPipe Tasks) + Cloud / Offline Database (Firebase Firestore & Local Cache)  
> **Repository Root**: `C:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main`  
> **Status**: Complete & Verified (114/114 Frontend Automated Tests Passing, 4/4 Backend Live Video Stream Tests Passing)

---

## Table of Contents

1. [Project Introduction](#1-project-introduction)
   - Abstract
   - Problem Statement
   - Motivation
   - Project Objectives
   - Scope of the Project
   - Proposed Solution
   - Comparison: Existing vs. Proposed System
   - Core Features
   - User Personas and Primary Use Cases
2. [Complete Technical Stack](#2-complete-technical-stack)
   - Comprehensive Stack Breakdown
   - Technology Stack Summary Table
   - Architectural Interplay & Communication Flow
3. [Frontend Design & Playful Geometric UI/UX](#3-frontend-design--playful-geometric-uiux)
   - Design Philosophy: Playful Geometric System
   - Curated Color Palette & Tokens
   - Typography Hierarchy
   - Kiosk Component Architecture & Responsibilities
   - Accessibility, Framing Guidelines, and Kid-Friendly Feedback
   - Teacher Management Portal Design
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
   - High-Level System Architecture Diagram (Mermaid)
   - Frontend Component & Hook Data Flow (Mermaid)
   - Backend Microservice Inference Pipeline (Mermaid)
   - WebSocket Real-Time Frame Protocol (Mermaid)
   - Kiosk Finite State Machine Lifecycle (Mermaid)
   - Persistence & Database Synchronization Flow (Mermaid)
5. [Biometric Face Recognition & Student Identification](#5-biometric-face-recognition--student-identification)
   - Purpose & Architectural Role
   - Detection & Descriptor Extraction Pipeline
   - 128-Dimensional Vector Matching Algorithm
   - Student Session Association
   - Multi-Person (`MULTIPLE_FACES`) and Guest Handling (`UNKNOWN_STUDENT`)
   - Biometric Data Privacy & Protection Standards
6. [Hand Recognition & Computer Vision Pipeline](#6-hand-recognition--computer-vision-pipeline)
   - Live Webcam Ingestion & 1:1 Aspect Ratio Preprocessing
   - MediaPipe HandLandmarker Integration
   - 21 3D Landmark Representation
   - Canonical Wrist-Centered Translation & Palm-Scale Normalization
   - 126-Dimensional Dual-Hand Feature Vector Construction
   - Rolling Temporal Buffer (`deque(maxlen=30)`)
   - PyTorch `HandwashLSTM` Inference Engine
   - Background Class Rejection & Temporal Debouncing
   - Sliding-Window Dynamic Movement Tracking
   - 6.0-Second Compliance Timer & Step Transition Criteria
7. [The Six WHO Handwashing Steps Implementation](#7-the-six-who-handwashing-steps-implementation)
   - Overview of WHO Protocol Steps
   - Step Specifications, Cues, and Class Mappings
   - Visual Instruction & Real-Time Student Guidance
8. [Dataset Collection, Annotation & Preprocessing](#8-dataset-collection-annotation--preprocessing)
   - Dataset Sources & Licensing
   - Video Annotation Schema & Temporal Segmentation
   - Landmark Extraction Pipeline (`extract_landmarks.py`)
   - Data Augmentation Strategies (Spatial & Temporal)
   - Train, Validation, and Test Partitioning
9. [Model Training, Optimization & Evaluation](#9-model-training-optimization--evaluation)
   - Deep Learning Architecture (`HandwashLSTM`)
   - Loss Function, Optimizer & Learning Rate Schedule
   - Early Stopping & Regularization
   - Empirical Evaluation Metrics & Benchmark Results
   - Real-World Generalization & Angle Invariance
10. [Backend Microservice Architecture](#10-backend-microservice-architecture)
    - FastAPI Application Lifecycle
    - WebSocket Protocol (`/ws_model`) & Binary Ingestion
    - Non-Blocking Threadpool Execution
    - Health (`/health`) and Readiness (`/ready`) Probes
    - Graceful Disconnect & Session Reset Handling
11. [Database & Session Management](#11-database--session-management)
    - Firestore Collections & Schema Definitions
    - Student Roster Schema
    - Session Record Schema
    - Daily Unknown Visits & Privacy-Preserving Counters
    - Offline & Development Resilience (Local Storage Cache)
    - Firebase Security Rules Architecture
12. [Scoring Formula, Analytics & Compliance Tiers](#12-scoring-formula-analytics--compliance-tiers)
    - Deterministic Scoring Formulation
    - Penalty Deductions (Missed Steps & Out-of-Order Violations)
    - Achievement Tier Breakdown
    - Hygiene Bonus Criteria
    - Chronological Compliance Streak Calculation
13. [Voice Assistant & Multilingual Guidance](#13-voice-assistant--multilingual-guidance)
    - Multilingual Support (English, Malayalam, Hindi)
    - Web Speech API Synthesis (`speechService.js`)
    - Voice Matching Heuristics Across Operating Systems
    - Pre-Recorded Audio Fallback Mechanism
    - Malayalam Audio Cue Optimization
14. [Testing, Quality Assurance & Verification](#14-testing-quality-assurance--verification)
    - Frontend Automated Testing Suite (Vitest)
    - Backend WebSocket Streaming Suite (Pytest / Live Runner)
    - Edge Case & Fault Tolerance Verification
15. [Installation, Setup & Deployment Guide](#15-installation-setup--deployment-guide)
    - Prerequisites & Hardware Requirements
    - Backend Environment Setup (`.venv310`)
    - Frontend Setup & Port Configuration
    - Production Container Deployment (Docker & Nginx)
16. [Known Limitations, Viva Q&A Defense & Future Work](#16-known-limitations-viva-qa-defense--future-work)
    - Current System Constraints
    - Common Viva Examination Questions & Answers
    - Planned Enhancements (IoT Smart Tap Integration, Edge TPUs)

---

## 1. Project Introduction

### Abstract
**SMART WASH** is an autonomous, touchless hand hygiene monitoring kiosk and pedagogical platform developed specifically for primary educational institutions. Leveraging real-time computer vision and deep sequential learning, the system automates student identity verification via 128-dimensional biometric facial embedding vectors and monitors adherence to the **World Health Organization (WHO) 6-step handwashing technique**. The vision pipeline couples client-side hand tracking via MediaPipe with a high-throughput, low-latency FastAPI backend executing a 2-layer PyTorch Long Short-Term Memory (LSTM) recurrent neural network over 30-frame temporal sequences of 126-dimensional spatial features. Interactive guidance is delivered through an energetic, kid-friendly "Playful Geometric" user interface equipped with an autonomous multilingual voice assistant supporting English, Malayalam, and Hindi. Comprehensive session analytics, student compliance histories, and gamified hygiene streaks are recorded in Firebase Firestore and visualized on a dedicated Teacher Portal.

### Problem Statement
Infectious diseases, gastrointestinal illnesses, and respiratory viruses spread readily in primary school environments, resulting in millions of lost school days annually. While proper handwashing with soap and water according to WHO guidelines reduces diarrheal disease by approximately 30% to 48% and respiratory infections by 20%, children rarely wash their hands effectively. Observational studies demonstrate that:
1. Students wash their hands for fewer than 5 seconds (far below the clinically recommended 20–30 seconds).
2. Children simply rub their palms together with water, completely omitting critical areas such as finger webs, knuckles, thumbs, and fingernails.
3. Paper posters and static instruction charts placed above school sinks are largely ignored by young learners.
4. Manual monitoring by teachers is labor-intensive, unscalable, and unfeasible during busy lunch and recess periods.

### Motivation
School hand hygiene requires automated, engaging, and real-time behavioral reinforcement. By replacing passive paper posters with an interactive, touchless smart kiosk, children receive instantaneous gamified audio-visual feedback that validates *technique* rather than merely *duration*. Integrating local language voice synthesis (such as Malayalam and Hindi) eliminates literacy barriers for early-grade students, ensuring health literacy begins at the formative stage of childhood education.

### Project Objectives
1. **Touchless Biometric Identification**: Authenticate students autonomously upon stepping up to the sink within 1.5 seconds without touching any screen surface or hardware buttons.
2. **Real-Time WHO Step Recognition**: Detect and classify each of the 6 recommended WHO handwashing steps in real time at $\ge 10$ frames per second (FPS) with low CPU inference latency ($<15$ ms).
3. **Strict Compliance & Motion Verification**: Enforce an active 6.0-second timer per step that automatically pauses when hand motion stops, ensuring children perform genuine scrubbing.
4. **Multilingual Interactive Pedagogy**: Provide spoken audio prompts and visual demonstrations in English, Malayalam, and Hindi tailored for young learners.
5. **Gamification & Analytics**: Calculate objective compliance scores (0–100), assign achievement tiers, track daily streaks, and empower teachers via an administrative dashboard with longitudinal hygiene metrics.

### Scope of the Project
- **Target Setting**: Elementary and primary school sink areas, preschools, and pediatric healthcare wards.
- **Hardware Profile**: Low-cost commercial hardware (standard desktop or laptop, single USB webcam, and standard touch-screen display or tablet).
- **Network Profile**: Optimized for low-bandwidth school networks; supports real-time local edge processing with automatic local caching if cloud database connectivity is temporarily lost.

### Proposed Solution
SMART WASH is structured as a dual-application ecosystem:
1. **Student Kiosk (`/student`)**: An edge-based, full-screen kiosk that runs directly in the browser at the sink. It ingests the webcam feed, identifies the student via `@vladmandic/face-api`, streams preprocessed 320×320 hand crops to a Python FastAPI microservice over high-speed WebSockets, receives real-time LSTM action classifications, tracks step progress, and speaks instructional prompts in the student's chosen language.
2. **Teacher Portal (`/teacher`)**: An administrative dashboard providing school educators with compliance trends, class average scores, attendance-hygiene correlations, leaderboard rankings, and student biometric enrollment.

### Comparison: Existing vs. Proposed System

| Feature / Metric | Conventional School Wash Station | Commercial Sensor Sinks | SMART WASH Platform |
| :--- | :--- | :--- | :--- |
| **Identity Verification** | None | None | Touchless 128-d Face ID (<1.5s) |
| **Hygiene Technique Validation** | None (Passive paper poster) | Presence sensor only (water runs) | 6 WHO Steps recognized via PyTorch LSTM |
| **Duration Enforcement** | None | Fixed water valve timer (e.g., 10s) | 6.0s active scrub timer per step |
| **Motion Gating** | None | None | Optical flow / landmark displacement check |
| **Language Inclusivity** | Static text (usually English only) | None | Multilingual TTS (English, Malayalam, Hindi) |
| **Behavioral Motivation** | None | None | Gamified Stars, Badges, Streaks & Tiers |
| **Teacher Visibility** | Zero visibility | Zero visibility | Class-wide compliance dashboard & trends |

### Core Features
- **Touchless 6-Step Kiosk Workflow**: Complete hand hygiene session from walk-up to walk-away without touching physical hardware.
- **Position-Invariant Landmark Extraction**: MediaPipe Tasks HandLandmarker isolates 21 spatial landmarks per hand, normalized by wrist position and palm scale to guarantee invariant tracking regardless of distance from the camera.
- **Deep Sequential Action Recognition**: 2-layer LSTM recurrent network evaluating temporal dynamics across a sliding 30-frame window.
- **Adaptive Fallback Architecture**: Seamlessly fuses ML predictions with angle-invariant 3D landmark geometric heuristics when lighting or camera perspectives deviate from training distributions.
- **Child-Centric "Playful Geometric" Interface**: High-contrast, bold, sticker-style UI with rounded corners, 3px-4px solid drop shadows, and vibrant colors designed to delight children.
- **Offline-First Resilience**: Automatically falls back to local storage and in-memory stores if school internet or Firebase connectivity drops.

### User Personas and Primary Use Cases
1. **Primary Student (Age 5–11)**:
   - *Use Case*: Approaches the sink before lunch. Kiosk greets the student by name in Malayalam, guides them through 6 bubbly scrubbing steps, plays energetic chimes, awards a "Superstar" badge, and displays their updated 5-day streak.
2. **School Teacher / Administrator**:
   - *Use Case*: Logs into `/teacher` from their classroom PC. Views the morning compliance percentage (e.g., 88% compliance), reviews which students missed Step 5 (Thumbs), enrolls new transfer students via webcam, and prints the weekly hygiene leaderboard.

---

## 2. Complete Technical Stack

### Comprehensive Stack Breakdown

#### 1. Client-Side Framework & Tooling
- **React 18.3.1**: Component-based UI library providing declarative rendering, state management via React hooks (`useState`, `useEffect`, `useRef`, `useCallback`, `useReducer`), and seamless integration with HTML5 Canvas.
- **Vite 5.4.21**: Ultra-fast next-generation frontend build tool and dev server featuring native ES module (ESM) hot module replacement (HMR) and optimized Rollup production bundling.
- **React Router DOM 7.18.3**: Client-side routing engine providing clean separation between the Root Mode Selector (`/`), Student Kiosk (`/student`), and Teacher Portal (`/teacher`).
- **Lucide React 1.61.0**: Modern, crisp, vector-based icon library utilized throughout UI badges, instruction cards, and status banners.

#### 2. Computer Vision & Biometric Libraries
- **@mediapipe/hands (v0.4) & @mediapipe/camera_utils (v0.3)**: WebAssembly (WASM)-compiled Google MediaPipe Hand tracking library executing client-side in the browser to detect hand presence, tracking bounds, and real-time movement velocity.
- **@vladmandic/face-api 1.7.15**: TensorFlow.js-based client-side facial detection and recognition suite. Implements SSD MobileNet v1 for face detection, a 68-point facial landmark network, and a deep convolutional neural network outputting 128-dimensional L2-normalized face embeddings.

#### 3. Backend Microservice & Deep Learning Framework
- **Python 3.10**: Core backend runtime environment ensuring binary compatibility across NumPy, PyTorch, and MediaPipe C++ extensions.
- **FastAPI 0.100.0+**: High-performance, asynchronous Python web framework providing native async WebSocket endpoints and Starlette threadpool offloading.
- **Uvicorn 0.22.0+**: Lightning-fast ASGI web server implementation based on `uvloop` and `httptools`.
- **PyTorch 2.2.1+cpu**: World-class deep learning framework executing inference of the trained `HandwashLSTM` model on edge CPU hardware with sub-2ms latency.
- **MediaPipe Tasks 0.10.14 (Python)**: High-precision C++ vision task runtime utilizing `hand_landmarker.task` for 2-hand 3D coordinate estimation.
- **OpenCV (opencv-python-headless 4.8.0+)**: Image processing library used for fast JPEG decoding, color-space conversion (BGR to RGB), and spatial cropping.
- **NumPy 1.26.4**: High-performance vectorized numerical operations for coordinate normalization, tensor formatting, and temporal array indexing.

#### 4. Database, Cloud Storage & Testing
- **Firebase Firestore 10.12.0**: Cloud-hosted NoSQL document database storing student profiles, biometric descriptors, and historical handwashing session records.
- **Firebase Authentication**: Secures administrative access for the Teacher Portal.
- **Vitest 1.6.1**: Blazing-fast Vite-native testing framework executing the 114 frontend automated unit, hook, and integration tests.
- **Pytest**: Python test runner verifying backend WebSocket connectivity and Kaggle dataset streaming tests.

### Technology Stack Summary Table

| Layer | Technology | Version | Purpose in SMART WASH |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 18.3.1 | Core UI state machine, views, and canvas rendering |
| **Build Tool** | Vite | 5.4.21 | Hot-reloading dev server & production chunk bundling |
| **Router** | React Router DOM | 7.18.3 | Kiosk (`/student`) and Teacher (`/teacher`) navigation |
| **Styling** | Vanilla CSS + Tokens | Custom | Playful Geometric design tokens and animations |
| **Icons** | Lucide React | 1.61.0 | Vector iconography for cards, steps, and alerts |
| **Browser Face AI** | @vladmandic/face-api | 1.7.15 | Client-side 128-d face embedding & Euclidean matching |
| **Browser Hand AI** | @mediapipe/hands | 0.4.16 | Client-side hand presence and motion path tracking |
| **Backend Framework** | FastAPI | >=0.100.0 | High-concurrency WebSocket & REST API server |
| **ASGI Server** | Uvicorn | >=0.22.0 | Asynchronous server running on port 4550 |
| **ML Framework** | PyTorch | 2.2.1+cpu | CPU inference of 2-layer `HandwashLSTM` network |
| **Backend Vision** | MediaPipe Tasks | >=0.10.14 | 3D landmark extraction via `hand_landmarker.task` |
| **Image Processing**| OpenCV | >=4.8.0 | Frame decoding and color-space transformations |
| **Math / Array** | NumPy | 1.26.4 | Vector math, wrist translation, feature normalization |
| **Database** | Firebase Firestore | 10.12.0 | Cloud document store for students & sessions |
| **Speech** | Web Speech API | Browser | Multilingual text-to-speech (TTS) engine |
| **Unit Testing** | Vitest | 1.6.1 | 114 frontend test assertions |
| **Integration Test**| Pytest / Python | 3.10 | Live Kaggle video stream WebSocket validation |

---

## 3. Frontend Design & Playful Geometric UI/UX

### Design Philosophy: Playful Geometric System
Children in primary schools respond negatively to cold, clinical, or overly sterile medical software. To maximize engagement, SMART WASH implements the **Playful Geometric** design system:
1. **Neo-Brutalist & Sticker Aesthetic**: Flat surfaces paired with heavy, crisp **2.5px to 3px solid borders** (`#1E293B`) and bold **3px to 4px hard drop shadows** without blur (`box-shadow: 4px 4px 0px 0px #1E293B`).
2. **Tactile Micro-Interactions**: Interactive elements feature subtle rotational offsets (`transform: rotate(-1deg)`), springy hover effects, and tactile press states (`transform: translate(2px, 2px)` with reduced shadow).
3. **High Information Clarity**: Generous padding, high contrast ratios exceeding WCAG AAA standards, and large icon stickers ensure readability from 1 meter away.

### Curated Color Palette & Tokens
The application relies on tailored, semantic color tokens defined in `index.css`:
- **Primary Brand Blue (`#2563EB`)**: Trust, cleanliness, and active technology. Used on key banners and titles.
- **Success Emerald (`#10B981`)**: Positive reinforcement, active scrubbing indicator, and completed checkmarks.
- **Warning Amber (`#F59E0B`)**: Motion pause alerts, debouncing state, and instruction cues.
- **Alert Coral (`#EF4444`)**: Missing hands alerts, multi-person warnings, and error modals.
- **Surface Card White (`#FFFFFF`)**: Clean, crisp container backgrounds.
- **Text & Stroke Ink (`#1E293B` / `#0F172A`)**: Deep navy-slate providing maximum legibility.
- **Background Cream / Canvas (`#F8FAFC` / `#EEF2FF`)**: Gentle, anti-glare canvas tones.

### Typography Hierarchy
- **Primary Headings**: Modern rounded sans-serif Google Font (`Outfit`, sans-serif) configured with `font-weight: 800` to deliver a friendly, approachable tone.
- **Body & Data Displays**: High-legibility geometric sans-serif (`Inter`, sans-serif) for tabular metrics, instructions, and diagnostic logs.

### Kiosk Component Architecture & Responsibilities

```
apps/student-app/src/
├── StudentApp.jsx            # Master Kiosk Orchestrator & State Machine Integration
├── studentStateMachine.js     # Reducer managing 9 discrete kiosk states
└── components/
    ├── LanguageSelectView.jsx # Multi-language prompt selection (English / Malayalam / Hindi)
    ├── StudentCamera.jsx      # Video ingestion, face landmark canvas, and hand-frame mirror
    ├── WashingView.jsx        # Active 6-step wash interface, timer display, and cue cards
    ├── FeedbackView.jsx       # Results screen, star rewards, compliance score, and countdown
    └── MultiPersonAlert.jsx   # Friendly modal warning when >1 child is in camera view
```

#### Detailed Responsibilities:
1. **[StudentApp.jsx](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/apps/student-app/src/StudentApp.jsx)**:
   - Houses the `kioskReducer` dispatch pipeline.
   - Coordinates `useFaceRecognition`, `useMediaPipeHands`, and `useStepRecognition`.
   - Handles timeout transitions (e.g., automatically resetting to `IDLE` after 8 seconds on the feedback screen).
2. **[StudentCamera.jsx](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/apps/student-app/src/components/StudentCamera.jsx)**:
   - Renders the mirrored webcam `<video>` element.
   - Displays the dashed yellow hand guide box: `[ 🤲 Wash & Rub Hands in View ]`.
   - Projects real-time face bounding boxes and student name tags when detected.
3. **[WashingView.jsx](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/apps/student-app/src/components/WashingView.jsx)**:
   - Renders the large **6.0s circular scrub timer** that animates clockwise during active movement.
   - Displays the current WHO step icon (e.g., 🤲 for Palm to Palm, 🤝 for Fingers Interlaced).
   - Renders the bottom 6-step progress bar displaying checkmarks for completed steps.
4. **[FeedbackView.jsx](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/apps/student-app/src/components/FeedbackView.jsx)**:
   - Renders the student's final score out of 100 with star graphics.
   - Displays total active wash duration and hygiene streak count.
   - Automatically triggers the celebratory confetti particle system for scores $\ge 70$.

---

## 4. System Architecture & Data Flow

### High-Level System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client [Browser Edge Runtime - localhost:3002]
        Cam[USB / Integrated Webcam] --> Vid[HTML5 Video Element]
        Vid --> FaceHook[useFaceRecognition Hook]
        FaceHook --> FaceAPI[@vladmandic/face-api SSD + Net]
        
        Vid --> HandHook[useMediaPipeHands Hook]
        HandHook --> MPClient[MediaPipe Hands WASM]
        
        Vid --> StepHook[useStepRecognition Hook]
        StepHook --> CanvasCrop[320x320 1:1 Center Crop]
        
        KioskSM[studentStateMachine Reducer]
        VoiceService[SpeechSynthesis Voice Engine]
    end

    subgraph Backend [FastAPI Microservice - localhost:4550]
        WS[/ws_model WebSocket Endpoint/]
        Threadpool[Starlette Async Threadpool]
        MPTasks[MediaPipe Tasks HandLandmarker]
        RollingBuf[SessionLandmarkBuffer - 30 Frames]
        LSTMEngine[PyTorch HandwashLSTM Model]
    end

    subgraph Database [Persistence Layer]
        Firestore[(Firebase Cloud Firestore)]
        LocalStorageCache[(Browser LocalStorage Cache)]
    end

    CanvasCrop -- Binary JPEG Frames @ 10 FPS --> WS
    WS --> Threadpool
    Threadpool --> MPTasks
    MPTasks --> RollingBuf
    RollingBuf --> LSTMEngine
    LSTMEngine -- JSON Prediction: class, confidence, hand_count --> WS
    WS -- Real-time Inferences --> StepHook

    StepHook --> KioskSM
    FaceHook --> KioskSM
    KioskSM --> VoiceService
    KioskSM -- Session Results --> Firestore
    KioskSM -- Fallback Offline Sync --> LocalStorageCache
```

### Backend Inference Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Kiosk as Kiosk Client (Browser)
    participant WS as FastAPI (/ws_model)
    participant Landmarker as MediaPipe HandLandmarker
    participant Buffer as SessionLandmarkBuffer
    participant LSTM as PyTorch HandwashLSTM

    Student->>Kiosk: Performs WHO Handwashing Motion
    loop Every 100ms (10 FPS)
        Kiosk->>Kiosk: Center-crop frame to 320x320 square
        Kiosk->>WS: Send binary JPEG frame
        WS->>Landmarker: Detect hand landmarks (C++ task)
        Landmarker-->>Buffer: Return 21 3D coordinates per hand
        Buffer->>Buffer: Normalize wrist origin & palm scale
        Buffer->>Buffer: Format canonical 126-d feature vector
        Buffer->>Buffer: Append to rolling deque (maxlen=30)
        alt Buffer has 30 frames
            Buffer->>LSTM: Forward pass tensor shape (1, 30, 126)
            LSTM-->>Buffer: Return logits & Softmax probabilities
            Buffer-->>WS: Package result (class, conf, hand_count)
            WS-->>Kiosk: Emit JSON Prediction
        else Buffer accumulating (<30 frames)
            Buffer-->>WS: Emit status: buffering
            WS-->>Kiosk: Emit JSON Buffering
        end
        Kiosk->>Kiosk: StepRecognitionEngine evaluates criteria & updates timer
    end
```

### Kiosk Finite State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> LANGUAGE_SELECT : Kiosk Startup
    LANGUAGE_SELECT --> IDLE : Language Selected (or 5s default)
    
    IDLE --> IDENTIFYING : Face Detected in Camera
    
    IDENTIFYING --> READY : Enrolled Face Matched (dist < 0.50)
    IDENTIFYING --> UNKNOWN_STUDENT : Unknown Face (after 3.5s / 10 checks)
    IDENTIFYING --> MULTIPLE_FACES : >1 Face in Frame
    
    UNKNOWN_STUDENT --> IDLE : Face departs (2s timeout)
    MULTIPLE_FACES --> IDENTIFYING : Extra faces depart
    
    READY --> WASHING : 3s Countdown (or Start Button)
    
    state WASHING {
        Step1_PalmToPalm --> Step2_PalmOverDorsum : 6.0s Active Rubbing Met
        Step2_PalmOverDorsum --> Step3_FingersInterlaced : 6.0s Active Rubbing Met
        Step3_FingersInterlaced --> Step4_BacksOfFingers : 6.0s Active Rubbing Met
        Step4_BacksOfFingers --> Step5_Thumbs : 6.0s Active Rubbing Met
        Step5_Thumbs --> Step6_Fingertips : 6.0s Active Rubbing Met
    }
    
    WASHING --> SCORING : Step 6 Completed (or Skip All)
    SCORING --> FEEDBACK : Compliance Score Calculated
    FEEDBACK --> IDLE : 8s Countdown / "Next Student" Pressed
```

---

## 5. Biometric Face Recognition & Student Identification

### Purpose & Architectural Role
The face recognition module serves as the **contactless authentication gateway** of SMART WASH. When a student steps in front of the sink, the system identifies the child automatically without requiring physical contact with fingerprint sensors, cards, or keypads—vital for maintaining hygiene before washing contaminated hands.

### Detection & Descriptor Extraction Pipeline
Operates inside [shared/hooks/useFaceRecognition.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/shared/hooks/useFaceRecognition.js) using `@vladmandic/face-api`:
1. **Face Detection (SSD MobileNet v1)**: Ingests the raw `<video>` stream at 400ms intervals, outputting bounding box coordinates and detection confidence.
2. **68-Point Facial Landmark Localization**: Computes canonical facial landmark positions (jawline, eyes, nose bridge, mouth contour) to align the face geometrically and eliminate head-tilt skew.
3. **128-Dimensional Deep Feature Embedding**: The aligned face patch is evaluated by a deep convolutional ResNet-style network, outputting a compact 128-element float vector $\mathbf{d} \in \mathbb{R}^{128}$ representing the unique biometric structure of the face.

### 128-Dimensional Vector Matching Algorithm
Implemented in `studentService.js`:
$$\text{Euclidean Distance } D(\mathbf{u}, \mathbf{v}) = \sqrt{\sum_{i=1}^{128} (u_i - v_i)^2}$$

- **Matching Criterion**: An input descriptor $\mathbf{u}$ is compared against all enrolled student vectors $\mathbf{v}_k \in \mathcal{S}$.
- **Decision Rule**:
  $$\text{Match} = \arg\min_k D(\mathbf{u}, \mathbf{v}_k) \quad \text{subject to} \quad \min_k D(\mathbf{u}, \mathbf{v}_k) < 0.50$$
- **Confidence Metric**: Normalized into a student-facing percentage:
  $$\text{Confidence} = \max\left(0, \min\left(100, \left(1.0 - \frac{D}{0.60}\right) \times 100\right)\right)$$
- **Temporal Stability Requirement**: To eliminate false positives, a student is only confirmed after **3 consecutive matching frames** ($>1.2$ seconds of continuous match).

### Multi-Person (`MULTIPLE_FACES`) and Guest Handling (`UNKNOWN_STUDENT`)
- **Crowd Prevention (`MULTIPLE_FACES`)**: If the detector finds $\ge 2$ faces with bounding box areas $>12\%$ of the camera canvas, the kiosk pauses identification, transitions to `MULTIPLE_FACES`, and plays an audio reminder: *"One little hero at a time! Please let only one person stand in front of the camera."*
- **Guest / Unknown Student (`UNKNOWN_STUDENT`)**: If an unrecognized person stands in front of the camera for $\ge 3.5$ seconds (10 evaluations) with no match $<0.50$, the kiosk transitions to `UNKNOWN_STUDENT` and advises: *"Unknown person. Please ask your teacher to add you to the class."* It records an anonymous count in `daily_unknown_visits` without storing image data.

### Biometric Data Privacy & Protection Standards
1. **No Raw Image Storage**: The student's facial photograph is never sent across the network during recognition; only the non-invertible 128-d numerical vector is evaluated.
2. **Local Edge Inference**: All facial descriptor computations run entirely on the client CPU via WebAssembly/WebGL inside the school's local browser sandbox.
3. **Children's Privacy Protection (COPPA / GDPR-K Compliance)**: Biometric vectors cannot be reverse-engineered into photographic images.

---

## 6. Hand Recognition & Computer Vision Pipeline

### Live Webcam Ingestion & 1:1 Aspect Ratio Preprocessing
In [shared/hooks/useStepRecognition.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/shared/hooks/useStepRecognition.js):
- Standard webcams output 16:9 ($1280 \times 720$) or 4:3 ($640 \times 480$) rectangular video frames.
- **Center-Crop Transformation**: To prevent aspect-ratio distortion and eliminate black padding bars that corrupt coordinate normalization, the frame is center-cropped to a true 1:1 square:
  ```javascript
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const cropSize = Math.min(vw, vh);
  const sx = Math.max(0, (vw - cropSize) / 2);
  const sy = Math.max(0, Math.min(vh - cropSize, (vh - cropSize) * 0.7));
  ctxRef.current.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 320, 320);
  ```
- The resulting $320 \times 320$ image is encoded into JPEG binary format (`quality: 0.60`) and transmitted over WebSocket `/ws_model` every 100 ms (10 FPS).

### MediaPipe HandLandmarker Integration
On the backend microservice (`backend/lstm_engine.py`), the image is decoded via OpenCV and processed by `mediapipe.tasks.python.vision.HandLandmarker`:
- Model Asset: `backend/models/mediapipe/hand_landmarker.task`
- Extracts 21 3D landmarks per hand:
  - Landmark 0: Wrist
  - Landmarks 1–4: Thumb (CMC, MCP, IP, Tip)
  - Landmarks 5–8: Index finger (MCP, PIP, DIP, Tip)
  - Landmarks 9–12: Middle finger (MCP, PIP, DIP, Tip)
  - Landmarks 13–16: Ring finger (MCP, PIP, DIP, Tip)
  - Landmarks 17–20: Pinky finger (MCP, PIP, DIP, Tip)

### Canonical Wrist-Centered Translation & Palm-Scale Normalization
To make hand gesture recognition completely invariant to where the child stands or how close their hands are to the camera lens:
1. **Origin Translation**: For every landmark $P_i = (x_i, y_i, z_i)$, translate relative to the wrist $P_0$:
   $$P'_i = P_i - P_0$$
   *(Result: Wrist is always strictly $(0, 0, 0)$)*
2. **Scale Invariance**: Compute the Euclidean palm scale from the wrist to the middle finger MCP joint ($P'_9$):
   $$S = \|P'_9\|_2 = \sqrt{(x'_9)^2 + (y'_9)^2 + (z'_9)^2}$$
3. **Normalized Coordinates**:
   $$P_{\text{norm}, i} = \frac{P'_i}{\max(S, 10^{-5})}$$
   Each hand is represented by $21 \times 3 = 63$ scale-invariant float values.

### 126-Dimensional Dual-Hand Feature Vector Construction
WHO handwashing inherently involves interactions between two hands. The feature extractor guarantees consistent slot assignment:
- **Two Hands Detected**:
  - The hand with smaller horizontal coordinate ($x_0 \le x_1$) occupies features `[0:63]`.
  - The other hand occupies features `[63:126]`.
- **Single Hand Detected (Palm-to-Palm Occlusion Handling)**:
  - During tight scrubbing (such as Step 1 Palm to Palm), MediaPipe often segments the clasped palms as a single merged hand.
  - The single hand vector is loaded into `[0:63]`, and a horizontally mirrored reflection ($x \to -x$) is projected into `[63:126]`.
  - This preserves feature continuity and prevents sudden sequence starvation.

### Rolling Temporal Buffer (`deque(maxlen=30)`)
Human handwashing actions cannot be identified from an isolated static image. A rolling temporal FIFO queue (`collections.deque(maxlen=30)`) maintains the most recent **30 consecutive frames**:
- At 10 FPS, 30 frames represent a continuous **3.0-second sliding temporal window**.
- Formatted as a PyTorch input tensor with shape:
  $$\mathbf{X} \in \mathbb{R}^{1 \times 30 \times 126} \quad (\text{Batch Size} = 1, \, \text{Sequence Length} = 30, \, \text{Feature Dimension} = 126)$$

### PyTorch `HandwashLSTM` Inference Engine
The model architecture defined in `lstm_engine.py`:
```python
class HandwashLSTM(nn.Module):
    def __init__(self, input_size=126, hidden_size=64, num_layers=2, num_classes=7, dropout=0.0):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.0
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
```
- Softmax is applied to `logits` to generate class confidence probabilities:
  $$P(\text{class} = c) = \frac{e^{z_c}}{\sum_{j=0}^{6} e^{z_j}}$$
- Returns predicted class label and float confidence score ($0.0 - 1.0$).

### Background Class Rejection & Temporal Debouncing
- **Class 0 (`background`)**: Represents hands resting, hands out of view, or unapproved movements. Prevents the system from advancing when hands are not actively washing.
- **Consecutive Frame Debouncing**: To prevent sporadic classification spikes from triggering progress, the frontend `StepRecognitionEngine` requires **8 consecutive matching frames** (strict mode) before transitioning from `DEBOUNCING` to `ACTIVE`.

### Sliding-Window Dynamic Movement Tracking
In [shared/services/stepModelService.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/shared/services/stepModelService.js):
- Merely holding hands in the target pose is insufficient; active friction and rubbing are mandatory.
- Tracks landmark displacement over a sliding 500 ms window:
  $$\text{Movement} = \frac{1}{N} \sum_{t=1}^{N} \frac{\|\mathbf{P}_t - \mathbf{P}_{t-1}\|_2}{\text{Hand Scale}}$$
- If $\text{Movement} < 0.020$, scrubbing is considered paused:
  - Timer freezes immediately.
  - UI displays: `⚠️ Movement Paused · Hands Still`.

### 6.0-Second Compliance Timer & Step Transition Criteria
- Each step maintains `activeTimeMs`.
- Every frame where `stepSatisfied == true` and `isHandsMoving == true`, `activeTimeMs += (now - lastFrameTime)`.
- When `activeTimeMs >= 6000` (6.0 seconds), the step completes:
  - Step icon flashes with emerald checkmark (`✓ Done`).
  - Audio chime plays.
  - Active step increments ($1 \to 2 \to 3 \to 4 \to 5 \to 6$).
  - Once Step 6 completes, the system transitions to `SCORING`.

---

## 7. The Six WHO Handwashing Steps Implementation

### Overview of WHO Protocol Steps
The World Health Organization specifies a 6-step hand hygiene technique to guarantee total coverage of all hand surfaces with soap foam.

| Step # | Official WHO Designation | Frontend Label (`en`) | PyTorch Model Class | Required Gesture | Spoken Audio Cue |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Palm to palm | **Palm to Palm** | `Step_1` | Palms pressed flat, rubbing firmly in circular friction. | *"Rub your palms together fast and make lots of bubbly foam!"* |
| **2** | Right palm over left dorsum & vice versa | **Palm over Dorsum** | `Step_2` | One palm placed over the back of the opposing hand, rubbing fingers across knuckles. | *"Scrub the back of each hand thoroughly, then swap sides!"* |
| **3** | Palm to palm with fingers interlaced | **Fingers Interlaced** | `Step_3` | Palms facing together with fingers interlocked, scrubbing the finger webs. | *"Interlace your fingers like a friendly high-five puzzle and scrub in between!"* |
| **4** | Backs of fingers to opposing palms | **Backs of Fingers** | `Step_4` | Fingertips curved into a fist, interlocking backs of fingers against opposing palm. | *"Lock your fingers together and give your knuckles a squeaky clean scrub!"* |
| **5** | Rotational rubbing of thumb | **Thumbs** | `Step_5` | Clasping thumb inside closed opposing palm and twisting in a rotational axis. | *"Hold each thumb and twist round and round like a rocket!"* |
| **6** | Rotational rubbing of fingertips in palm | **Fingertips** | `Step_6` | Clasping fingertips together and rubbing small circular motions against palm. | *"Tickle your palm with your fingertips in circles to clean under the nails!"* |

---

## 8. Dataset Collection, Annotation & Preprocessing

### Dataset Sources & Licensing
The deep sequential LSTM model was trained on video recordings adhering to the World Health Organization multi-angle hand hygiene dataset:
- Primary Dataset: WHO Standard Hand Hygiene Multi-Angle Video Dataset.
- Video Characteristics: 30 FPS RGB video recordings capturing diverse subjects with variations in skin tone, hand morphology, and handwashing speed.
- Annotations File: [ml/training/annotations.json](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/ml/training/annotations.json).

### Video Annotation Schema & Temporal Segmentation
Every video in `annotations.json` specifies temporal start and end timestamps for each active action segment:
```json
{
  "filename": "1.mp4",
  "participant_id": "P1",
  "fps": 30.0,
  "total_frames": 301,
  "segments": [
    {
      "action": "Step_1",
      "class_id": 1,
      "start_sec": 0.5,
      "end_sec": 9.5
    }
  ]
}
```

### Landmark Extraction Pipeline (`extract_landmarks.py`)
Executed via:
```bash
python ml/training/extract_landmarks.py --video_dir Handwashing/ --annotations ml/training/annotations.json --output ml/training/dataset_landmarks.npz
```
1. Reads frames sequentially with OpenCV.
2. Extracts 21 3D landmarks per hand via MediaPipe Tasks.
3. Normalizes landmarks relative to wrist and palm scale.
4. Generates 30-frame temporal slices with a stride of 2 frames.
5. Emits `dataset_landmarks.npz` containing arrays `X` (sequences), `y` (class labels), and `video_ids` (for subject-independent grouping).

### Data Augmentation Strategies
To ensure robustness against webcam variations:
1. **Horizontal Flipping (`augment_sequence_flip`)**:
   - Inverts the $X$ coordinates ($x \to -x$).
   - Swaps Left Hand `[0:63]` and Right Hand `[63:126]` slices.
2. **Rotational Jitter (`augment_sequence_rotate`)**:
   - Applies random 2D in-plane rotational matrices between $-12^\circ$ and $+12^\circ$.
3. **Additive Gaussian Noise (`augment_sequence_noise`)**:
   - Injects zero-mean Gaussian jitter ($\sigma = 0.008$) to simulate sensor noise and landmark detection jitter.

---

## 9. Model Training, Optimization & Evaluation

### Deep Learning Architecture (`HandwashLSTM`)
- **Input Dimension**: 126 features (2 hands $\times$ 21 landmarks $\times$ 3 coordinates).
- **Sequence Length**: 30 frames (3.0 seconds at 10 FPS).
- **Recurrent Layer 1**: LSTM (126 inputs $\to$ 64 hidden units, batch-first).
- **Recurrent Layer 2**: LSTM (64 inputs $\to$ 64 hidden units).
- **Dense Projection 1**: Linear(64 $\to$ 32) + ReLU activation.
- **Regularization**: Dropout ($p = 0.20$) on dense layer.
- **Classification Head**: Linear(32 $\to$ 7 classes) outputting raw unnormalized logits.

### Training Configuration & Command
Executed via:
```bash
python ml/training/train_lstm.py --data ml/training/dataset_landmarks.npz --output_dir backend/models/lstm/ --epochs 50 --batch_size 64 --lr 0.001 --patience 5
```
- **Loss Function**: PyTorch `nn.CrossEntropyLoss()`
- **Optimizer**: Adam ($\beta_1 = 0.9, \beta_2 = 0.999, \epsilon = 10^{-8}$)
- **Learning Rate Scheduler**: `ReduceLROnPlateau(mode='min', factor=0.5, patience=3)`
- **Early Stopping**: Monitored on validation loss with patience of 5 epochs.

### Empirical Evaluation Metrics & Benchmark Results
Evaluated on the held-out test split of 9,488 augmented landmark sequences:
- **Test Classification Accuracy**: **97.31%**
- **Macro Precision**: 0.9733
- **Macro Recall**: 0.9731
- **Macro F1-Score**: **0.9732**
- **Inference Latency**: **1.11 ms per sample** on standard Intel/AMD CPU (Zero GPU required).

---

## 10. Backend Microservice Architecture

### FastAPI Application Lifecycle
The backend server ([backend/main.py](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/backend/main.py)) initializes upon startup:
1. Loads the PyTorch `HandwashLSTM` checkpoint onto CPU memory (`backend/models/lstm/handwash_lstm.pt`).
2. Initializes the MediaPipe Tasks `HandLandmarker` instance in `RunningMode.IMAGE`.
3. Binds CORS middleware allowing cross-origin requests from `http://localhost:3000` and `http://localhost:3002`.

### WebSocket Protocol (`/ws_model`) & Binary Ingestion
- **Connection**: Kiosk connects via `ws://127.0.0.1:4550/ws_model`.
- **Payload**: Client streams binary JPEG blobs directly over the WebSocket connection.
- **Threadpool Offloading**: To prevent blocking FastAPI's asynchronous event loop, CPU-intensive MediaPipe extraction and PyTorch inference are dispatched to the Starlette worker threadpool:
  ```python
  result = await run_in_threadpool(session_buffer.process_frame, frame)
  ```
- **JSON Response Schema**:
  ```json
  {
    "timestamp": 1729864200123.4,
    "prediction": {
      "class": "Step_1",
      "confidence": 0.985,
      "status": "active",
      "hand_count": 2,
      "hand_confidence": 0.89,
      "movement": 0.045,
      "is_moving": true,
      "top5": {
        "Step_1": 0.985,
        "background": 0.012,
        "Step_3": 0.003
      }
    }
  }
  ```

### Health & Readiness Probes
- **`GET /health`**: Returns HTTP 200 with server uptime and timestamp.
- **`GET /ready`**: Confirms model loaded status, execution device (`cpu`), and class mappings.

---

## 11. Database & Session Management

### Firestore Collections & Schema Definitions

#### 1. `students` Collection
Stores registered student profiles and 128-d face descriptors:
```typescript
interface Student {
  studentId: string;        // Unique identifier (e.g., "STU_101")
  name: string;             // Student full name (e.g., "Alex River")
  classId: string;          // Class/Grade (e.g., "Grade 5-A")
  photoUrl?: string;        // Avatar image URL
  descriptor: number[];     // 128-element float array (Face embedding)
  enrolledAt: Timestamp;    // Enrollment timestamp
  updatedAt: Timestamp;    // Last update timestamp
}
```

#### 2. `sessions` Collection
Stores individual handwashing session compliance logs:
```typescript
interface Session {
  id: string;               // Unique session ID
  studentId: string;        // Associated student ID
  studentName: string;      // Cached student name
  classId: string;          // Class identifier
  timestamp: Timestamp;     // Session completion timestamp
  score: number;            // Overall compliance score (0 - 100)
  complianceScore: number;  // Sanitized compliance score
  status: 'completed' | 'abandoned';
  mode: 'strict' | 'dry' | 'test';
  completedSteps: number[]; // Array of completed step IDs e.g. [1, 2, 3, 4, 5, 6]
  steps: Array<{
    stepNumber: number;
    completed: boolean;
    durationMs: number;
    avgConfidence: number;
  }>;
  sessionDurationMs: number;// Total session time in milliseconds
}
```

### Offline & Development Resilience (Local Storage Cache)
In [shared/services/sessionService.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/shared/services/sessionService.js) and `studentService.js`:
- If `VITE_FIREBASE_API_KEY` contains `MOCK_API_KEY` or if the school's internet connection drops, the system activates **Local Development / Mock Mode**.
- Seed data (`SEED_STUDENTS` and `SEED_SESSIONS`) are automatically loaded and persisted into browser `localStorage` (`smartwash_mock_students` and `smartwash_mock_sessions`).
- This guarantees uninterrupted operation during classroom network outages.

---

## 12. Scoring Formula, Analytics & Compliance Tiers

### Deterministic Scoring Formulation
In [shared/services/scoringService.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/shared/services/scoringService.js):
$$\text{Base Score} = \left(\frac{\text{Completed Steps}}{6}\right) \times 100$$
$$\text{Total Score} = \max\left(0, \, \min\left(100, \, \text{Base Score} - P_{\text{missed}} - P_{\text{out\_of\_order}}\right)\right)$$

- **Penalty for Missed Steps ($P_{\text{missed}}$)**: $15 \text{ points}$ deducted per skipped WHO step.
- **Penalty for Out-of-Order Violations ($P_{\text{out\_of\_order}}$)**: $10 \text{ points}$ deducted per out-of-order step jump.

### Achievement Tier Breakdown

| Score Range | Tier Identifier | Student Badge | Spoken Audio Feedback |
| :---: | :--- | :--- | :--- |
| **90 – 100** | `SUPERSTAR` | 🌟 Superstar Washer | *"Superstar! Outstanding WHO handwash technique!"* |
| **70 – 89** | `GREAT_JOB` | 🧼 Great Job Champ | *"Great job! You followed the correct technique!"* |
| **40 – 69** | `GOOD_TRY` | 👍 Good Try Buddy | *"Good try! Cover all areas thoroughly next time."* |
| **0 – 39** | `TRY_AGAIN` | 🫧 Let's Practice | *"Let's try again! Keep practicing all 6 WHO steps."* |

### Hygiene Bonus Criteria
To incentivize mastery, a **Hygiene Bonus (+10 points)** is awarded **only** if:
1. $\text{Total Score} \ge 70$, AND
2. $\text{Completed Steps} \ge 4$.
*(Guarantees that poor washes e.g. 2/100 never receive a bonus).*

### Chronological Compliance Streak Calculation
A student's streak represents the consecutive count of compliant washes:
1. Sessions are sorted in descending chronological order ($t_{\text{now}} \to t_{\text{past}}$).
2. Developer test sessions (`mode: 'test'` or `'dry'`) are excluded.
3. Streak increments for every session where $\text{Score} \ge 70$ and $\text{status} \ne \text{'abandoned'}$.
4. The streak terminates upon encountering the first non-compliant session.

---

## 13. Voice Assistant & Multilingual Guidance

### Multilingual Support
All instructional text and speech cues are translated in [src/i18n/translations.js](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/src/i18n/translations.js):
- **English (`en`)**: Universal educational vocabulary.
- **Malayalam (`ml`)**: Primary regional language tailored for Kerala schools.
- **Hindi (`hi`)**: National language prompt support.

### Web Speech API Synthesis (`speechService.js`)
- Uses the browser's native `window.speechSynthesis`.
- Automatically queries available system voices via `getVoiceForLanguage(lang)`.
- Prioritizes Indian regional voice accents:
  - English: `en-IN`, `en-GB`, `en-US`
  - Malayalam: `ml-IN`, `ml`
  - Hindi: `hi-IN`, `hi`

### Pre-Recorded Audio Fallback Mechanism
If a client machine (such as an older school workstation or Linux thin client) lacks native regional text-to-speech voices for Malayalam or Hindi:
1. `speechService.js` attempts to play pre-recorded studio `.mp3` audio files located in `/audio/{lang}_{cue}.mp3`.
2. If the audio file is absent, it falls back to synthesized English instructions accompanied by visual subtitle cards.

---

## 14. Testing, Quality Assurance & Verification

### Frontend Automated Testing Suite (Vitest)
SMART WASH includes 12 comprehensive test files verifying **114 automated test assertions**:
- `tests/detectionGating.test.js`: Validates 60% confidence threshold, hand presence gating, and motion tracking.
- `tests/timingAndMovement.test.js`: Verifies 6.0-second active accumulation, movement freeze pause, and grace periods.
- `tests/dryMode.test.js`: Evaluates 3D landmark geometric fallback algorithms across all 6 steps.
- `tests/faceAndSessionFlow.test.js`: Tests 128-d Euclidean vector matching, multi-face alerts, and unknown person workflows.
- `tests/streakAndAnalytics.test.js`: Tests chronological streak sorting, tier boundaries, and bonus logic.
- `tests/system.test.js`: End-to-end integration test verifying full kiosk state machine transitions.

**Test Run Command**:
```bash
npm test -- --passWithNoTests
```
*Result: 12 passed (12), 114 passed (114) in 2.15s.*

### Backend WebSocket Streaming Suite
Located in [tests/test_backend_live_stream.py](file:///c:/Users/jobiy/Downloads/smart-wash-main/smart-wash-main/tests/test_backend_live_stream.py):
- Connects live client to `ws://localhost:4550/ws_model`.
- Streams 30 real Kaggle WHO dataset handwashing frames from `HandWash_001_A_01_G01.mp4`.
- Validates:
  1. Real Kaggle video detection & active classification ($\text{Confidence} = 1.00$).
  2. Position invariance: Hands at top-left.
  3. Position invariance: Hands at bottom-right.
  4. Motionless freeze test: Verifies zero landmark displacement marks `is_moving: false`.

---

## 15. Installation, Setup & Deployment Guide

### Prerequisites & Hardware Requirements
- **Operating System**: Windows 10/11, Ubuntu Linux 20.04+, or macOS.
- **Hardware**: Dual-core x86_64 CPU, 4 GB RAM, standard 720p USB webcam.
- **Software**: Node.js 18+ (LTS), Python 3.10.

### Backend Environment Setup
```bash
# 1. Navigate to repository root
cd C:\Users\jobiy\Downloads\smart-wash-main\smart-wash-main

# 2. Activate Python 3.10 virtual environment
.\.venv310\Scripts\activate

# 3. Verify installed dependencies
pip install -r backend/requirements.txt

# 4. Start the FastAPI Uvicorn microservice on Port 4550
python -m uvicorn backend.main:app --host 127.0.0.1 --port 4550
```

### Frontend Setup & Port Configuration
```bash
# 1. In a separate terminal, install npm packages
npm install

# 2. Run unit tests to verify baseline integrity
npm test

# 3. Start Vite Development Server on Port 3002
npm run dev -- --port 3002 --strictPort
```
- Access Kiosk: **`http://localhost:3002/student`**
- Access Teacher Portal: **`http://localhost:3002/teacher`**

---

## 16. Known Limitations, Viva Q&A Defense & Future Work

### Current System Constraints
1. **Severe Backlighting**: Intense sunlight directly behind the user can cause silhouettes that degrade facial landmark localization.
2. **Foam Occlusion**: While the LSTM model was trained with augmented hand mirroring to handle soapy hands, excessive soap lather can occasionally obscure fingertip landmarks during Step 6.
3. **Single Camera Perspective**: A top-down 45-degree angled camera provides optimal palm visibility compared to a horizontal laptop camera.

### Common Viva Examination Questions & Answers

#### Q1: Why did you choose an LSTM over a 2D Convolutional Neural Network (CNN)?
> *Answer*: A single 2D CNN evaluates static spatial features from an isolated image frame. Handwashing steps (such as rubbing palms vs. rubbing fingertips) share similar hand shapes but differ completely in **temporal velocity, cyclic trajectory, and rotational motion**. An LSTM models temporal sequence dynamics across 30 frames ($3.0$ seconds), recognizing continuous gestures rather than static poses. Furthermore, operating on 126 coordinate landmarks rather than raw RGB pixels reduces inference latency to just **1.11 ms on CPU**, enabling real-time performance without an expensive GPU.

#### Q2: How do you handle children of different heights and distances from the sink?
> *Answer*: We implemented **wrist-centered origin translation** and **palm-scale normalization**. For every detected hand, landmark coordinates are translated so the wrist is $(0, 0, 0)$, and all coordinates are divided by the Euclidean distance between the wrist and middle finger MCP joint. Consequently, whether a student stands close to the camera or far away, the normalized landmark coordinates remain scale-invariant.

#### Q3: How is student privacy protected during face recognition?
> *Answer*: SMART WASH complies with student biometric privacy standards. Photographs are processed locally in the client browser using `@vladmandic/face-api`. Raw images are **never** transmitted to our backend server or stored in the database. Only a mathematical 128-dimensional floating-point embedding vector is saved. It is computationally irreversible and cannot reconstruct the student's face.

#### Q4: What happens if the school's internet connection fails during the school day?
> *Answer*: The entire computer vision pipeline (MediaPipe, face-api, and FastAPI) runs locally on the school's edge machine. For database persistence, our `sessionService` and `studentService` feature an automatic **localStorage cache fallback**. Sessions and streaks are recorded locally in the browser and displayed without interruption, syncing once internet connectivity resumes.

### Planned Enhancements
- **Edge Microcontroller Deployment**: Porting the inference pipeline to an NVIDIA Jetson Nano or Raspberry Pi 5 with Google Coral Edge TPU.
- **IoT Smart Solenoid Tap Integration**: Interfacing an ESP32 microcontroller with a relay valve to autonomously dispense soap and control water flow strictly when the vision system verifies active scrubbing.

---

*SMART WASH — Final Year B.Tech CSE Project Documentation*  
*Verified for Academic Presentation, Project Report Submission & Technical Viva Voce.*
