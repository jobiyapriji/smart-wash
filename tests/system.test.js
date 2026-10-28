import { describe, it, expect, beforeEach } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { calculateHandwashScore } from '../shared/services/scoringService.js';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from '../apps/student-app/src/studentStateMachine.js';
import { createSession, updateSession, getAllSessions, getSession } from '../shared/services/sessionService.js';

describe('Phase 1: Model Label Normalization (Rule 4)', () => {
  let engine;
  beforeEach(() => {
    engine = new StepRecognitionEngine();
  });

  it('correctly maps raw YOLO labels to integer steps and rejects unmapped classes', () => {
    expect(engine.getYoloClassStep('Step_1')).toBe(1);
    expect(engine.getYoloClassStep('Step_2_Left')).toBe(2);
    expect(engine.getYoloClassStep('Step_2_Right')).toBe(2);
    expect(engine.getYoloClassStep('Step_6_Left')).toBe(6);
    // Rule 4: Step_7 must be treated as "no step" (-1), never as progress
    expect(engine.getYoloClassStep('Step_7_Right')).toBe(-1);
    expect(engine.getYoloClassStep('Step_7_Left')).toBe(-1);
    expect(engine.getYoloClassStep('background')).toBe(-1);
    expect(engine.getYoloClassStep('unknown_junk')).toBe(-1);
  });
});

describe('Phase 2: Temporal Debounce & Strict Step Crediting (Rule 3)', () => {
  let engine;
  beforeEach(() => {
    engine = new StepRecognitionEngine({
      consecutiveFramesRequired: 8,
      confidenceThreshold: 0.60
    });
  });

  it('ignores single-frame high confidence anomalies (flicker)', () => {
    // 1 frame of Step 2 while expecting Step 1 with hands
    engine.predict({ class: 'Step_2_Right', confidence: 0.90, handCount: 2, handConfidence: 0.9, handMovement: 0.08 });
    expect(engine.currentStep).toBe(1);
    expect(engine.activeTimeMs).toBe(0);
    expect(engine.missedSteps.length).toBe(0);
  });

  it('rejects cross-step execution when target is Step 1 (Rule 3: no cross-step credit)', () => {
    // Current step is 1. Send consecutive high-confidence frames for Step 2.
    let now = performance.now();
    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_2_Right',
        confidence: 0.90,
        handCount: 2,
        handConfidence: 0.9,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    // Must NOT advance to Step 2, must NOT credit Step 1
    expect(engine.currentStep).toBe(1);
    expect(engine.activeTimeMs).toBe(0);
  });
});

describe('Phase 4: Deterministic Scoring Calculation (Rule 7)', () => {
  it('awards 100 points for a perfect sequence', () => {
    const completed = [1, 2, 3, 4, 5, 6];
    const missed = [];
    const result = calculateHandwashScore(completed, missed);
    expect(result.totalScore).toBe(100);
    expect(result.grade).toBe('Superstar');
    expect(result.bonusAwarded).toBe(true);
  });

  it('deducts 15 points per missed step', () => {
    const completed = [2, 3, 4, 5, 6];
    const missed = [1];
    const result = calculateHandwashScore(completed, missed);
    expect(result.totalScore).toBe(68);
    expect(result.grade).toBe('Good try');
    // Rule 7: Score < 70 never gets hygiene bonus
    expect(result.bonusAwarded).toBe(false);
  });

  it('deducts 10 points per out-of-order violation', () => {
    const completed = [1, 3, 2, 4, 5, 6];
    const missed = [];
    const result = calculateHandwashScore(completed, missed);
    expect(result.totalScore).toBe(90);
    expect(result.grade).toBe('Superstar');
    expect(result.bonusAwarded).toBe(true);
  });

  it('clamps score at 0 for terrible performance and awards 0 bonus', () => {
    const completed = [1];
    const missed = [2, 3, 4, 5, 6];
    const result = calculateHandwashScore(completed, missed);
    expect(result.totalScore).toBe(0);
    expect(result.grade).toBe("Let's try again");
    expect(result.bonusAwarded).toBe(false);
    expect(result.bonusPoints).toBe(0);
  });
});

describe('Phase 5: Hand Rubbing Motion & Navigation Controls (Rule 1 & 2)', () => {
  let engine;
  beforeEach(() => {
    engine = new StepRecognitionEngine({
      consecutiveFramesRequired: 8,
      confidenceThreshold: 0.60
    });
  });

  it('accumulates active time and completes step when hand rubbing motion with 2 hands is detected', () => {
    let now = 1000;
    // Step 1 target duration is 6000ms.
    // First 8 frames satisfy debounce, then activeTime accumulates
    for (let i = 0; i < 75; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.currentStep).toBe(2);
    expect(engine.completedSteps).toContain(1);
  });

  it('pauses timer accumulation when hand movement stops or hands are missing', () => {
    let now = 1000;
    // Debounce + run for 2 seconds with motion
    for (let i = 0; i < 30; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    const activeTimeBeforePause = engine.activeTimeMs;
    expect(activeTimeBeforePause).toBeGreaterThan(1000);

    // Hands still (movement < 0.05)
    for (let i = 0; i < 20; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.01 // below threshold!
      }, now);
      now += 100;
    }
    // activeTimeMs must not advance while paused
    expect(engine.activeTimeMs).toBe(activeTimeBeforePause);
    expect(engine.currentStep).toBe(1);
  });

  it('skipStep advances to next step for debug mode', () => {
    expect(engine.currentStep).toBe(1);
    const result = engine.skipStep();
    expect(result.smoothedStep).toBe(2);
    expect(engine.currentStep).toBe(2);
    expect(engine.completedSteps).toContain(1);
  });

  it('jumpToStep sets new target step and marks skipped steps as missed', () => {
    expect(engine.currentStep).toBe(1);
    const result = engine.jumpToStep(4);
    expect(result.smoothedStep).toBe(4);
    expect(engine.currentStep).toBe(4);
    expect(result.missedSteps).toEqual([1, 2, 3]);
  });

  it('finishes session when step 6 completes', () => {
    engine.jumpToStep(6);
    expect(engine.currentStep).toBe(6);
    const res = engine.skipStep();
    expect(res.isFinished).toBe(true);
    expect(engine.completedSteps).toContain(6);
  });
});

describe('Phase 6: Kiosk State Machine & Session Lifecycle', () => {
  it('manages full kiosk state transition from LANGUAGE_SELECT to IDLE to FEEDBACK and RESET', () => {
    let state = INITIAL_KIOSK_STATE;
    expect(state.currentState).toBe(KIOSK_STATES.LANGUAGE_SELECT);

    state = kioskReducer(state, { type: 'SELECT_LANGUAGE' });
    expect(state.currentState).toBe(KIOSK_STATES.IDLE);

    state = kioskReducer(state, { type: 'START_IDENTIFICATION' });
    expect(state.currentState).toBe(KIOSK_STATES.IDENTIFYING);

    state = kioskReducer(state, {
      type: 'STUDENT_IDENTIFIED',
      payload: {
        student: { studentId: 'STU_101', name: 'Alex River' },
        sessionId: 'sess_123'
      }
    });
    expect(state.currentState).toBe(KIOSK_STATES.READY);
    expect(state.student.name).toBe('Alex River');

    state = kioskReducer(state, { type: 'START_WASHING' });
    expect(state.currentState).toBe(KIOSK_STATES.WASHING);

    state = kioskReducer(state, {
      type: 'STEP_COMPLETED',
      payload: { stepNumber: 1, durationMs: 6000, avgConfidence: 0.92, completed: true }
    });
    expect(state.completedSteps.length).toBe(1);

    state = kioskReducer(state, { type: 'START_SCORING' });
    expect(state.currentState).toBe(KIOSK_STATES.SCORING);

    state = kioskReducer(state, {
      type: 'SCORING_COMPLETE',
      payload: { score: 95, steps: state.completedSteps }
    });
    expect(state.currentState).toBe(KIOSK_STATES.FEEDBACK);
    expect(state.finalScore).toBe(95);

    state = kioskReducer(state, { type: 'RESET_TO_IDLE' });
    expect(state.currentState).toBe(KIOSK_STATES.IDLE);
    expect(state.student).toBeNull();
  });

  it('handles multiple faces and unknown student states gracefully', () => {
    let state = INITIAL_KIOSK_STATE;
    state = kioskReducer(state, { type: 'MULTIPLE_FACES_DETECTED' });
    expect(state.currentState).toBe(KIOSK_STATES.MULTIPLE_FACES);

    state = kioskReducer(state, { type: 'UNKNOWN_FACE_DETECTED' });
    expect(state.currentState).toBe(KIOSK_STATES.UNKNOWN_STUDENT);
  });

  it('creates and updates session persistence in mock service', async () => {
    const session = await createSession('STU_TEST', 'Test Student');
    expect(session.id).toBeDefined();

    const updated = await updateSession(session.id, {
      complianceScore: 92,
      status: 'completed',
      completedSteps: [1, 2, 3, 4, 5, 6]
    });
    expect(updated).toBe(true);

    const retrieved = await getSession(session.id);
    expect(retrieved.complianceScore).toBe(92);
    expect(retrieved.studentName).toBe('Test Student');

    const allSessions = await getAllSessions();
    expect(allSessions.length).toBeGreaterThan(0);
  });
});

describe('Phase 6: Production WebSocket Resolution', () => {
  it('resolves correct ws url in standalone mode and behind reverse proxy', async () => {
    const { getWebSocketEndpoint } = await import('../shared/hooks/useStepRecognition.js');
    
    // In node/test environment without window
    expect(getWebSocketEndpoint()).toBe('ws://localhost:4550/ws_model');

    // Simulate browser window on port 3000
    globalThis.window = {
      location: { protocol: 'http:', hostname: 'localhost', port: '3000', host: 'localhost:3000' }
    };
    expect(getWebSocketEndpoint()).toBe('ws://localhost:4550/ws_model');

    // Simulate browser window on port 3002 (different Vite port)
    globalThis.window.location.port = '3002';
    globalThis.window.location.host = 'localhost:3002';
    expect(getWebSocketEndpoint()).toBe('ws://localhost:4550/ws_model');

    // Simulate browser window on LAN host (e.g. 192.168.1.100:3000)
    globalThis.window.location.hostname = '192.168.1.100';
    globalThis.window.location.port = '3000';
    globalThis.window.location.host = '192.168.1.100:3000';
    expect(getWebSocketEndpoint()).toBe('ws://192.168.1.100:4550/ws_model');

    // Simulate HTTPS deployment
    globalThis.window.location.protocol = 'https:';
    expect(getWebSocketEndpoint()).toBe('wss://192.168.1.100:4550/ws_model');

    // Simulate production reverse proxy (port 80 or 443)
    globalThis.window.location.protocol = 'https:';
    globalThis.window.location.port = '443';
    globalThis.window.location.host = 'smartwash.school.edu';
    expect(getWebSocketEndpoint()).toBe('wss://smartwash.school.edu/ws_model');

    // Clean up
    delete globalThis.window;
  });

  it('converts HTTPS API URLs to secure WSS and prevents mixed-content errors in production', async () => {
    const { getWebSocketEndpoint } = await import('../shared/hooks/useStepRecognition.js');

    const httpsWindow = {
      location: { protocol: 'https:', hostname: 'smart-wash.vercel.app', port: '', host: 'smart-wash.vercel.app' }
    };

    // 1. Derives wss:// from HTTPS VITE_API_URL
    const ep1 = getWebSocketEndpoint({
      apiUrl: 'https://smart-wash-backend.onrender.com',
      windowObj: httpsWindow
    });
    expect(ep1).toBe('wss://smart-wash-backend.onrender.com/ws_model');

    // 2. Automatically converts accidental http:// VITE_API_URL to wss:// when on HTTPS
    const ep2 = getWebSocketEndpoint({
      apiUrl: 'http://smart-wash-backend.onrender.com',
      windowObj: httpsWindow
    });
    expect(ep2).toBe('wss://smart-wash-backend.onrender.com/ws_model');

    // 3. Automatically upgrades accidental ws:// VITE_WS_URL to wss:// when on HTTPS
    const ep3 = getWebSocketEndpoint({
      wsUrl: 'ws://smart-wash-backend.onrender.com/ws_model',
      windowObj: httpsWindow
    });
    expect(ep3).toBe('wss://smart-wash-backend.onrender.com/ws_model');

    // 4. Handles domain without protocol on HTTPS
    const ep4 = getWebSocketEndpoint({
      apiUrl: 'smart-wash-backend.onrender.com',
      windowObj: httpsWindow
    });
    expect(ep4).toBe('wss://smart-wash-backend.onrender.com/ws_model');

    // 5. Normalizes trailing slashes and appends /ws_model
    const ep5 = getWebSocketEndpoint({
      apiUrl: 'https://smart-wash-backend.onrender.com/',
      windowObj: httpsWindow
    });
    expect(ep5).toBe('wss://smart-wash-backend.onrender.com/ws_model');

    // 6. Explicit VITE_WS_URL override takes precedence over VITE_API_URL
    const ep6 = getWebSocketEndpoint({
      wsUrl: 'wss://dedicated-ws.example.com/custom_path/ws_model',
      apiUrl: 'https://smart-wash-backend.onrender.com',
      windowObj: httpsWindow
    });
    expect(ep6).toBe('wss://dedicated-ws.example.com/custom_path/ws_model');

    // 7. Missing production config on HTTPS defaults to wss:// (never insecure ws://)
    const ep7 = getWebSocketEndpoint({
      windowObj: httpsWindow
    });
    expect(ep7).toBe('wss://smart-wash.vercel.app/ws_model');
    expect(ep7.startsWith('wss://')).toBe(true);
  });

  it('preserves ws:// and local backend in development HTTP environments', async () => {
    const { getWebSocketEndpoint } = await import('../shared/hooks/useStepRecognition.js');

    const httpDevWindow = {
      location: { protocol: 'http:', hostname: 'localhost', port: '3000', host: 'localhost:3000' }
    };

    // 1. Preserves local ws:// on localhost
    const ep1 = getWebSocketEndpoint({
      apiUrl: 'http://localhost:4550',
      windowObj: httpDevWindow
    });
    expect(ep1).toBe('ws://localhost:4550/ws_model');

    // 2. Preserves explicit ws:// in local dev
    const ep2 = getWebSocketEndpoint({
      wsUrl: 'ws://127.0.0.1:4550/ws_model',
      windowObj: httpDevWindow
    });
    expect(ep2).toBe('ws://127.0.0.1:4550/ws_model');

    // 3. In HTTP dev, if remote API uses https://, derives wss://
    const ep3 = getWebSocketEndpoint({
      apiUrl: 'https://smart-wash-backend.onrender.com',
      windowObj: httpDevWindow
    });
    expect(ep3).toBe('wss://smart-wash-backend.onrender.com/ws_model');
  });
});

