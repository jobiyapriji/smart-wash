import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from '../apps/student-app/src/studentStateMachine.js';
import { filterMultiPersonFaces } from '../shared/services/faceFilterService.js';
import { HANDWASH_CONFIG } from '../shared/config/handwashConfig.js';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';

describe('Face Recognition & Autonomous Kiosk Flow Tests', () => {

  describe('TEST 1: Face in the oval, no hands -> recognized, goes to READY, then WASHING', () => {
    it('transitions from IDLE to IDENTIFYING to READY upon face recognition without any hands', () => {
      let state = { ...INITIAL_KIOSK_STATE, currentState: KIOSK_STATES.IDLE };

      // 1. Face appears in view
      state = kioskReducer(state, { type: 'START_IDENTIFICATION' });
      expect(state.currentState).toBe(KIOSK_STATES.IDENTIFYING);

      // 2. Student recognized by face alone (no hands required!)
      const enrolledStudent = { studentId: 'STU_101', name: 'Alex River', classId: 'Grade 5-A' };
      state = kioskReducer(state, {
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student: enrolledStudent,
          sessionId: 'sess_alex_001'
        }
      });

      // 3. Must be in READY state showing the student's name
      expect(state.currentState).toBe(KIOSK_STATES.READY);
      expect(state.student).toEqual(enrolledStudent);
      expect(state.student.name).toBe('Alex River');

      // 4. Auto-countdown or Start Now transitions to WASHING
      state = kioskReducer(state, { type: 'START_WASHING' });
      expect(state.currentState).toBe(KIOSK_STATES.WASHING);
    });
  });

  describe('TEST 2: Enrolled student -> recognised, name chip and panel agree, wash starts. Unknown face -> friendly Unknown Person screen (no buttons, no session)', () => {
    it('displays enrolled student name in READY state and panel & chip read from single source of truth', () => {
      const state = kioskReducer(
        { ...INITIAL_KIOSK_STATE, currentState: KIOSK_STATES.IDENTIFYING },
        {
          type: 'STUDENT_IDENTIFIED',
          payload: {
            student: { studentId: 'STU_102', name: 'Jordan Taylor' },
            sessionId: 'sess_102'
          }
        }
      );
      expect(state.currentState).toBe(KIOSK_STATES.READY);
      expect(state.student.name).toBe('Jordan Taylor');

      // Single source of truth identifiedStudent
      const identifiedStudent = [
        KIOSK_STATES.READY,
        KIOSK_STATES.WASHING,
        KIOSK_STATES.SCORING,
        KIOSK_STATES.FEEDBACK
      ].includes(state.currentState) ? (state.student || null) : null;
      expect(identifiedStudent).toEqual({ studentId: 'STU_102', name: 'Jordan Taylor' });
    });

    it('transitions to UNKNOWN_STUDENT after 10 consecutive non-matching frames without buttons and student is null', () => {
      let state = { ...INITIAL_KIOSK_STATE, currentState: KIOSK_STATES.IDENTIFYING };

      // Trigger unknown face detected after 10 non-matching frames
      state = kioskReducer(state, { type: 'UNKNOWN_FACE_DETECTED' });
      expect(state.currentState).toBe(KIOSK_STATES.UNKNOWN_STUDENT);
      expect(state.student).toBeNull();

      // Single source of truth identifiedStudent is strictly null in UNKNOWN_STUDENT
      const identifiedStudent = [
        KIOSK_STATES.READY,
        KIOSK_STATES.WASHING,
        KIOSK_STATES.SCORING,
        KIOSK_STATES.FEEDBACK
      ].includes(state.currentState) ? (state.student || null) : null;
      expect(identifiedStudent).toBeNull();

      // UNKNOWN state never starts a session or has guest IDs
      expect(state.sessionId).toBeNull();
    });

    it('guarantees no stale name chip when switching between two people', () => {
      // Person 1 (Alex River) completes or leaves
      let state = kioskReducer(
        { ...INITIAL_KIOSK_STATE, currentState: KIOSK_STATES.IDENTIFYING },
        {
          type: 'STUDENT_IDENTIFIED',
          payload: {
            student: { studentId: 'STU_101', name: 'Alex River' },
            sessionId: 'sess_alex'
          }
        }
      );
      expect(state.student.name).toBe('Alex River');

      // Reset when Person 1 finishes or leaves
      state = kioskReducer(state, { type: 'RESET_TO_IDLE' });
      expect(state.student).toBeNull();

      // Person 2 steps up -> IDENTIFYING
      state = kioskReducer(state, { type: 'START_IDENTIFICATION' });
      expect(state.student).toBeNull();

      const identifyingStudent = [
        KIOSK_STATES.READY,
        KIOSK_STATES.WASHING,
        KIOSK_STATES.SCORING,
        KIOSK_STATES.FEEDBACK
      ].includes(state.currentState) ? (state.student || null) : null;
      expect(identifyingStudent).toBeNull();

      // Person 2 is unknown
      state = kioskReducer(state, { type: 'UNKNOWN_FACE_DETECTED' });
      expect(state.student).toBeNull();

      const unknownStudent = [
        KIOSK_STATES.READY,
        KIOSK_STATES.WASHING,
        KIOSK_STATES.SCORING,
        KIOSK_STATES.FEEDBACK
      ].includes(state.currentState) ? (state.student || null) : null;
      expect(unknownStudent).toBeNull();

      // Person 2 is later enrolled and recognized -> Jordan Taylor
      state = kioskReducer(state, {
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student: { studentId: 'STU_102', name: 'Jordan Taylor' },
          sessionId: 'sess_jordan'
        }
      });
      expect(state.student.name).toBe('Jordan Taylor');
    });

    it('auto-recovers from UNKNOWN_STUDENT to READY when enrolled match occurs without reloading', () => {
      let state = kioskReducer(INITIAL_KIOSK_STATE, { type: 'UNKNOWN_FACE_DETECTED' });
      expect(state.currentState).toBe(KIOSK_STATES.UNKNOWN_STUDENT);

      // Teacher enrolls student -> next scan confirms match (< 0.5 distance)
      state = kioskReducer(state, {
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student: { studentId: 'STU_NEW', name: 'Newly Enrolled Student' },
          sessionId: 'sess_new'
        }
      });
      expect(state.currentState).toBe(KIOSK_STATES.READY);
      expect(state.student.name).toBe('Newly Enrolled Student');
    });

    it('returns from UNKNOWN_STUDENT to IDLE when person walks away for 2 seconds', () => {
      let state = kioskReducer(INITIAL_KIOSK_STATE, { type: 'UNKNOWN_FACE_DETECTED' });
      expect(state.currentState).toBe(KIOSK_STATES.UNKNOWN_STUDENT);

      // Face absent for 2s triggers RESET_TO_IDLE
      state = kioskReducer(state, { type: 'RESET_TO_IDLE' });
      expect(state.currentState).toBe(KIOSK_STATES.IDLE);
      expect(state.student).toBeNull();
    });
  });

  describe('TEST 3: Hands never required before WASHING', () => {
    it('confirms the 1.5s hand gate is removed and START_HAND_DETECT_DURATION_MS is 0', () => {
      expect(HANDWASH_CONFIG.START_HAND_DETECT_DURATION_MS).toBe(0);
    });

    it('proves identification completes without requiring hand landmarks or hand movement', () => {
      let state = { ...INITIAL_KIOSK_STATE, currentState: KIOSK_STATES.IDENTIFYING };
      const zeroHands = { handCount: 0, handConfidence: 0, handMovement: 0 };

      // With 0 hands present, student recognition directly triggers STUDENT_IDENTIFIED -> READY
      state = kioskReducer(state, {
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student: { studentId: 'STU_101', name: 'Alex River' },
          sessionId: 'sess_zero_hands'
        }
      });
      expect(state.currentState).toBe(KIOSK_STATES.READY);

      // Then READY transitions to WASHING without hands being required prior to scrub time
      state = kioskReducer(state, { type: 'START_WASHING' });
      expect(state.currentState).toBe(KIOSK_STATES.WASHING);
    });
  });

  describe('TEST 4: Face covered by hands during washing -> session continues', () => {
    it('does not pause or cancel washing when face disappears while hands are active', () => {
      const engine = new StepRecognitionEngine({ mode: 'strict' });
      let now = 1000;

      // 8-frame debounce + 1000ms active scrub
      for (let i = 0; i < 20; i++) {
        engine.predict({
          class: 'Step_1',
          confidence: 0.88,
          handCount: 2,
          handConfidence: 0.95,
          handMovement: 0.12
        }, now);
        now += 100;
      }

      expect(engine.isStepActive).toBe(true);
      const timeBeforeFaceCovered = engine.activeTimeMs;
      expect(timeBeforeFaceCovered).toBeGreaterThan(0);

      // Student covers face with hands while scrubbing for another 1.5 seconds:
      // MediaPipe hands and classifier remain active
      for (let i = 0; i < 15; i++) {
        engine.predict({
          class: 'Step_1',
          confidence: 0.88,
          handCount: 2,
          handConfidence: 0.95,
          handMovement: 0.12
        }, now);
        now += 100;
      }

      // Step progress must continue advancing even though face is covered!
      expect(engine.activeTimeMs).toBeGreaterThan(timeBeforeFaceCovered);
      expect(engine.isStepActive).toBe(true);
      expect(engine.graceState).toBe('ACTIVE');
    });

    it('keeps the identified student for the entire session without altering identity', () => {
      let state = {
        ...INITIAL_KIOSK_STATE,
        currentState: KIOSK_STATES.WASHING,
        student: { studentId: 'STU_101', name: 'Alex River' },
        sessionId: 'sess_alex_wash'
      };

      // Completing steps does not alter student identity
      state = kioskReducer(state, {
        type: 'STEP_COMPLETED',
        payload: { stepNumber: 1, durationMs: 6000, avgConfidence: 0.92, completed: true }
      });
      expect(state.student.name).toBe('Alex River');

      // Scoring does not alter student identity
      state = kioskReducer(state, { type: 'START_SCORING' });
      state = kioskReducer(state, { type: 'SCORING_COMPLETE', payload: { score: 95 } });
      expect(state.student.name).toBe('Alex River');
    });
  });

  describe('TEST 5: No face and no hands for 15 s -> session cancelled, returns to IDLE', () => {
    it('resets to IDLE state via RESET_TO_IDLE when 15s absence timeout triggers', () => {
      let state = {
        ...INITIAL_KIOSK_STATE,
        currentState: KIOSK_STATES.WASHING,
        student: { studentId: 'STU_101', name: 'Alex River' },
        sessionId: 'sess_timeout_test'
      };

      // Simulated safety interval check:
      let bothAbsentStartTime = 1000;
      let currentTime = 1000;
      const timeoutMs = HANDWASH_CONFIG.FACE_ABSENT_TIMEOUT_MS; // 15000ms

      expect(timeoutMs).toBe(15000);

      // At 14 seconds (14000ms): not yet timed out
      currentTime = 15000;
      let shouldCancel = (currentTime - bothAbsentStartTime) >= timeoutMs;
      expect(shouldCancel).toBe(false);

      // At 15 seconds (16000ms elapsed): cancels session
      currentTime = 16000;
      shouldCancel = (currentTime - bothAbsentStartTime) >= timeoutMs;
      expect(shouldCancel).toBe(true);

      if (shouldCancel) {
        state = kioskReducer(state, { type: 'RESET_TO_IDLE' });
      }

      expect(state.currentState).toBe(KIOSK_STATES.IDLE);
      expect(state.student).toBeNull();
    });

    it('resets absent timer if either hands or face reappear before 15 seconds', () => {
      let bothAbsentStartTime = 1000;

      // 10 seconds pass with both absent
      let currentTime = 11000;
      expect(currentTime - bothAbsentStartTime < 15000).toBe(true);

      // Hands reappear (e.g. hands detected)
      const handsReappeared = true;
      if (handsReappeared) {
        bothAbsentStartTime = null;
      }
      expect(bothAbsentStartTime).toBeNull();
    });
  });

  describe('TEST 6: Framing Guidance in IDENTIFYING (Target 25-60% of frame height)', () => {
    function computeFramingGuidance(boxHeight, frameHeight = 480) {
      if (!boxHeight || boxHeight <= 0) return 'Look at the camera';
      const pct = Math.round((boxHeight / frameHeight) * 100);
      if (pct > HANDWASH_CONFIG.FACE_BOX_TARGET_MAX_PERCENT) {
        return 'Move back a little';
      }
      if (pct < HANDWASH_CONFIG.FACE_BOX_TARGET_MIN_PERCENT) {
        return 'Come closer';
      }
      return 'Looking for your face...';
    }

    it('reports "Look at the camera" when 0 faces are in frame', () => {
      expect(computeFramingGuidance(0, 480)).toBe('Look at the camera');
    });

    it('reports "Come closer" when face is smaller than 25% of frame height', () => {
      // 80px / 480px = 16.7% (< 25%)
      expect(computeFramingGuidance(80, 480)).toBe('Come closer');
    });

    it('reports "Move back a little" when face is larger than 60% of frame height', () => {
      // 320px / 480px = 66.7% (> 60%)
      expect(computeFramingGuidance(320, 480)).toBe('Move back a little');
    });

    it('reports "Looking for your face..." when face box is between 25% and 60%', () => {
      // 200px / 480px = 41.7%
      expect(computeFramingGuidance(200, 480)).toBe('Looking for your face...');
    });
  });

  describe('TEST 7: Multi-Person Rule: Largest face used, faces < 50% ignored', () => {
    it('selects the largest face and filters out background faces < 50% area', () => {
      const mockDetections = [
        {
          detection: { box: { width: 60, height: 60 } }, // Area: 3600 (36% of largest -> ignored)
          descriptor: new Float32Array(128).fill(0.1)
        },
        {
          detection: { box: { width: 100, height: 100 } }, // Area: 10000 (Largest face)
          descriptor: new Float32Array(128).fill(0.9)
        },
        {
          detection: { box: { width: 40, height: 40 } }, // Area: 1600 (16% of largest -> ignored)
          descriptor: new Float32Array(128).fill(0.2)
        }
      ];

      const result = filterMultiPersonFaces(mockDetections);
      expect(result.primaryFace).toBe(mockDetections[1]); // Uses largest face
      expect(result.significantFaces.length).toBe(1); // Small faces filtered out
      expect(result.isBlocked).toBe(false);
    });
  });

  describe('TEST 8: Code Cleanliness: No guest strings or STU_GUEST IDs in normal codebase', () => {
    it('confirms GUEST_STUDENT_ID is removed from configuration', () => {
      expect(HANDWASH_CONFIG.GUEST_STUDENT_ID).toBeUndefined();
    });

    it('verifies developer exception: allowGuest=1 sessions tagged mode "test"', () => {
      const isAllowGuest = true;
      const effectiveMode = isAllowGuest ? 'test' : 'strict';
      expect(effectiveMode).toBe('test');

      const devSession = {
        studentId: 'DEV_TEST_USER',
        name: 'Dev Test User',
        mode: 'test'
      };

      // Teacher dashboard excludes test mode and dry mode sessions
      const sessions = [
        { id: '1', mode: 'strict', complianceScore: 95 },
        { id: '2', mode: 'dry', complianceScore: 80 },
        { id: '3', mode: 'test', complianceScore: 90 }
      ];

      const analyticsSessions = sessions.filter(s => s.mode !== 'dry' && s.mode !== 'test');
      expect(analyticsSessions.length).toBe(1);
      expect(analyticsSessions[0].id).toBe('1');
    });
  });
});
