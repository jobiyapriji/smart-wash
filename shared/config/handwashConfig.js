/**
 * SMART WASH — Global Handwash & Computer Vision Configuration
 * Centralized tunable parameters for hand detection gating, temporal debouncing,
 * motion tracking, face recognition, and scoring tiers.
 */

export const HANDWASH_CONFIG = {
  // Detection Mode Configuration
  // "strict": Real handwashing with soap & water (default)
  // "dry": Dry testing mode without soap, water, or foam (?mode=dry)
  DETECTION_MODE: 'strict',


  // 1. Detection Gating & Crediting (Rule 3)
  CONFIDENCE_THRESHOLD: 0.60,         // Strict mode YOLO model confidence threshold
  DRY_CONFIDENCE_THRESHOLD: 0.35,     // Dry mode lower classifier confidence threshold
  DEBOUNCE_FRAMES: 8,                 // Strict mode debounce frames required only when starting a step
  DRY_DEBOUNCE_FRAMES: 4,             // Dry mode debounce frames required only when starting a step
  STEP_TARGET_DURATION_MS: 6000,      // Required duration per WHO step (6.0 seconds)

  // 2. Hand Presence & MediaPipe Configuration
  HAND_LANDMARK_MIN_CONFIDENCE: 0.30, // MediaPipe minimum confidence for hand presence (lowered to 0.30)
  HAND_DETECTION_CONFIDENCE: 0.30,    // MediaPipe minDetectionConfidence
  HAND_PRESENCE_CONFIDENCE: 0.30,     // MediaPipe minHandPresenceConfidence
  HAND_TRACKING_CONFIDENCE: 0.30,     // MediaPipe minTrackingConfidence
  MAX_NUM_HANDS: 2,                   // MediaPipe maxNumHands
  HANDS_MISSING_PAUSE_MS: 500,        // Max allowed time without hands before showing "Show your hands"
  HAND_STATE_HOLD_MS: 500,            // Hold last hand state for brief dropouts (< 500ms)
  GRACE_PERIOD_MS: 500,               // 500ms grace window before timer pauses

  // 3. Dynamic Movement Thresholds from Hand Landmarks (Sliding 500ms Window)
  MOVEMENT_WINDOW_MS: 500,            // 500 ms sliding window for cumulative path length & articulation
  MOVEMENT_EMA_ALPHA: 0.40,           // Light EMA smoothing factor to suppress camera noise while preserving rapid rub response
  DRY_MOVEMENT_PATH_THRESHOLD: 0.025, // Dry mode movement threshold: sensitive for light rubbing
  STRICT_MOVEMENT_PATH_THRESHOLD: 0.035, // Strict mode movement threshold: 3.5% of hand scale / 500ms
  MOVEMENT_THRESHOLD: 0.020,          // Baseline movement threshold (normalized path / scale)
  FINGERTIP_MOVEMENT_THRESHOLD: 0.030,// Fingertip velocity threshold for rotational steps 5 & 6
  ARTICULATION_THRESHOLD: 0.018,      // Internal joint articulation threshold (wrist-invariant hand flexing)

  // 4. Overlapping & Merged Hands for Step 1
  MERGED_HAND_ASPECT_RATIO_MIN: 0.90, // Aspect ratio (width/height) indicating palms pressed together
  MERGED_HAND_SCALE_RATIO_MIN: 1.05,  // Box width / handScale ratio indicating merged hands

  // 5. Tunable Landmark-Geometry Fallback Thresholds (Approximate Rules & Angle-Invariant Metrics)
  GEOMETRY_THRESHOLDS: {
    STEP_1_PALM_DISTANCE: 0.85,       // Max distance between palm centers normalized by hand-width (~0.85)
    STEP_1_FINGER_DIR_DOT: 0.35,      // Min dot product of palm-to-finger direction vectors (> 0.35)
    STEP_1_NORMAL_OPPOSITION: -0.15,  // Max 3D palm normal dot product (<= -0.15 indicates opposing palmar faces)
    STEP_1_BOX_OVERLAP: 0.20,         // Min bounding box overlap ratio (> 20%)
    STEP_2_BOX_OVERLAP: 0.30,         // Min bounding box overlap ratio (> 30%)
    STEP_3_BOX_OVERLAP: 0.45,         // Min bounding box overlap ratio (> 45%)
    STEP_3_MIN_ALTERNATIONS: 2,       // Min alternating x-order fingertip switches between left & right hand
    STEP_4_CURL_RATIO: 0.95,          // Max curled fingertip-to-palm distance ratio relative to hand scale
    STEP_4_RESTING_DIST: 1.25,        // Max distance between curled fingers and opposing palm
    STEP_5_THUMB_PALM_DIST: 0.80,     // Max distance from thumb tip to opposing palm/fist area
    STEP_5_ROTATION_MOVEMENT: 0.03,   // Movement threshold required during thumb twisting
    STEP_6_FINGERTIP_DIST: 0.65,      // Max distance from fingertips of one hand to opposing palm center
    STEP_6_CIRCULAR_MOVEMENT: 0.03    // Circular movement threshold required during fingertip rubbing
  },

  // 6. Face Recognition & Multi-Person Filtering (Face Only Identification)
  FACE_MATCH_DISTANCE_THRESHOLD: 0.50, // Strict Euclidean distance for student match (< 0.5)
  FACE_CONSECUTIVE_FRAMES_REQUIRED: 3, // Consecutive frames matching student before identifying (3-5 frames)
  FACE_STABLE_FRAMES_REQUIRED: 3,      // Face stable for 3-5 frames (~1s) before running recognition
  FACE_NO_MATCH_TIMEOUT_MS: 3000,      // No match after ~3s -> UNKNOWN_STUDENT
  FACE_BOX_TARGET_MIN_PERCENT: 25,     // Framing target min: 25% of frame height ("Come closer" if below)
  FACE_BOX_TARGET_MAX_PERCENT: 60,     // Framing target max: 60% of frame height ("Move back a little" if above)
  READY_COUNTDOWN_SECONDS: 3,          // Short countdown (3s) in READY state before auto-transitioning to WASHING
  START_HAND_DETECT_DURATION_MS: 0,    // Hands NOT required during identification (reverted gate)
  FACE_ABSENT_TIMEOUT_MS: 15000,       // Cancel session ONLY after 15s with NO face AND NO hands
  MIN_SECONDARY_FACE_AREA_RATIO: 0.50, // Ignore background faces with area < 50% of largest face
  MULTI_FACE_CONSECUTIVE_FRAMES: 10,   // Require secondary face for 10 consecutive frames before blocking
  DOMINANT_FACE_STABLE_AUTO_CONTINUE_MS: 2000, // If largest face is stable for 2s, continue

  // 7. Session & Persistence Constraints (Rule 6 & Rule 7)
  MIN_VERIFIED_STEPS_TO_SAVE: 1,      // Must have at least 1 verified step to save to Firebase
  MIN_VERIFIED_SCRUB_TIME_SEC: 10,    // Total verified scrub time must be >= 10s to persist

  // 8. Scoring & Tier Thresholds (Rule 7)
  TIERS: {
    SUPERSTAR: { min: 90, max: 100, label: 'Superstar' },
    GREAT_JOB: { min: 70, max: 89, label: 'Great job' },
    GOOD_TRY: { min: 40, max: 69, label: 'Good try' },
    TRY_AGAIN: { min: 0, max: 39, label: "Let's try again" }
  },
  BONUS_MIN_SCORE: 70,                // Score must be >= 70 to get hygiene bonus
  BONUS_MIN_STEPS: 4,                 // Must complete >= 4 verified steps to get hygiene bonus
  BONUS_POINTS: 50,
  ENABLE_ADAPTIVE_FUSION: true        // Enables Adaptive Ensemble Fusion in kiosk live recognition
};

/**
 * Model class -> WHO Step (1-6) explicit mapping table (Rule 4).
 * Unmapped classes (such as Step_7_Left, Step_7_Right, background, etc.)
 * are NOT mapped (return null / -1) and must NEVER count as step progress.
 */
export const YOLO_TO_WHO_STEP_MAP = {
  'Step_1': 1,
  'Step_2': 2,
  'Step_2_Left': 2,
  'Step_2_Right': 2,
  'Step_3': 3,
  'Step_4': 4,
  'Step_4_Left': 4,
  'Step_4_Right': 4,
  'Step_5': 5,
  'Step_5_Left': 5,
  'Step_5_Right': 5,
  'Step_6': 6,
  'Step_6_Left': 6,
  'Step_6_Right': 6
};

/**
 * Required hands count per WHO step.
 * When rubbing vigorously, touching hands frequently merge into a single region.
 * We require at least 1 hand presence detected with active movement.
 */
export const STEP_REQUIRED_HANDS = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1
};

export default HANDWASH_CONFIG;
