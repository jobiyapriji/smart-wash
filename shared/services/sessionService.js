/**
 * SMART WASH — Session Service
 * Owned by Jesty (Face ID + Backend)
 * 
 * Handles CRUD operations for Firestore 'sessions' collection.
 * Supports real Firestore + seamless local memory fallback for mock mode.
 */

import { db, isMockFirebase } from '../firebaseConfig.js';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { createDefaultSession, validateSessionContract } from '../types.js';

// In-memory & localStorage storage for mock environment / offline testing
const SEED_SESSIONS = [
  // Alex River (STU_101): 5 consecutive high-scoring sessions (Streak: 5, Avg: 94)
  {
    id: 'seed_sess_101_1',
    sessionId: 'seed_sess_101_1',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    score: 96,
    complianceScore: 96,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5, 6],
    steps: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 'seed_sess_101_2',
    sessionId: 'seed_sess_101_2',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    score: 92,
    complianceScore: 92,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5, 6],
    steps: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 'seed_sess_101_3',
    sessionId: 'seed_sess_101_3',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    score: 98,
    complianceScore: 98,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5, 6],
    steps: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 'seed_sess_101_4',
    sessionId: 'seed_sess_101_4',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    score: 90,
    complianceScore: 90,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5],
    steps: [1, 2, 3, 4, 5]
  },
  {
    id: 'seed_sess_101_5',
    sessionId: 'seed_sess_101_5',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    score: 95,
    complianceScore: 95,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5, 6],
    steps: [1, 2, 3, 4, 5, 6]
  },

  // Jordan Taylor (STU_102): 3 consecutive good sessions (Streak: 3, Avg: 85)
  {
    id: 'seed_sess_102_1',
    sessionId: 'seed_sess_102_1',
    studentId: 'STU_102',
    studentName: 'Jordan Taylor',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    score: 88,
    complianceScore: 88,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5],
    steps: [1, 2, 3, 4, 5]
  },
  {
    id: 'seed_sess_102_2',
    sessionId: 'seed_sess_102_2',
    studentId: 'STU_102',
    studentName: 'Jordan Taylor',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    score: 85,
    complianceScore: 85,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4, 5],
    steps: [1, 2, 3, 4, 5]
  },
  {
    id: 'seed_sess_102_3',
    sessionId: 'seed_sess_102_3',
    studentId: 'STU_102',
    studentName: 'Jordan Taylor',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 49 * 3600 * 1000).toISOString(),
    score: 82,
    complianceScore: 82,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4],
    steps: [1, 2, 3, 4]
  },

  // Sam Chen (STU_103): Low recent score (55 < 70) breaks streak (Streak: 0, Avg: 70)
  {
    id: 'seed_sess_103_1',
    sessionId: 'seed_sess_103_1',
    studentId: 'STU_103',
    studentName: 'Sam Chen',
    classId: 'Grade 5-B',
    timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    score: 55,
    complianceScore: 55,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2],
    steps: [1, 2]
  },
  {
    id: 'seed_sess_103_2',
    sessionId: 'seed_sess_103_2',
    studentId: 'STU_103',
    studentName: 'Sam Chen',
    classId: 'Grade 5-B',
    timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    score: 80,
    complianceScore: 80,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3, 4],
    steps: [1, 2, 3, 4]
  },
  {
    id: 'seed_sess_103_3',
    sessionId: 'seed_sess_103_3',
    studentId: 'STU_103',
    studentName: 'Sam Chen',
    classId: 'Grade 5-B',
    timestamp: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
    score: 75,
    complianceScore: 75,
    status: 'completed',
    mode: 'strict',
    completedSteps: [1, 2, 3],
    steps: [1, 2, 3]
  }
];

const loadMockSessions = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('smartwash_mock_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(parsed);
      }
    }
  } catch (e) {
    console.warn('[sessionService] Could not load mock sessions from localStorage:', e);
  }
  return new Map(SEED_SESSIONS.map(s => [s.id, s]));
};

const mockSessionsStore = loadMockSessions();

const saveMockSessions = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('smartwash_mock_sessions', JSON.stringify(Array.from(mockSessionsStore.entries())));
    }
  } catch (e) {
    console.warn('[sessionService] Could not save mock sessions to localStorage:', e);
  }
};

/**
 * Creates a new student handwashing session
 * @param {string} studentId 
 * @param {string} studentName 
 * @param {string} identityMethod
 * @returns {Promise<{ id: string, session: import('../types.js').Session }>}
 */
export async function createSession(studentId, studentName, identityMethod = 'face_recognition', classId = 'UNKNOWN', mode = 'strict') {
  const initialSession = {
    ...createDefaultSession(studentId, studentName, identityMethod, classId),
    mode
  };
  
  if (db && !isMockFirebase) {
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        ...initialSession,
        timestamp: serverTimestamp()
      });
      return { id: docRef.id, session: { ...initialSession, id: docRef.id } };
    } catch (err) {
      console.warn('[sessionService] Firestore addDoc failed, using local store:', err.message);
    }
  }

  // Mock / Fallback Mode
  const mockId = `mock_session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const createdSession = { ...initialSession, id: mockId };
  mockSessionsStore.set(mockId, createdSession);
  saveMockSessions();
  return { id: mockId, session: createdSession };
}

/**
 * Updates an ongoing or finished session
 * @param {string} sessionId 
 * @param {Partial<import('../types.js').Session>} updateData 
 * @returns {Promise<boolean>}
 */
export async function updateSession(sessionId, updateData) {
  if (!sessionId) throw new Error('sessionId is required for updateSession');

  if (db && !isMockFirebase) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.warn('[sessionService] Firestore updateDoc failed, falling back to mock:', err.message);
    }
  }

  // Mock / Fallback Mode
  const existing = mockSessionsStore.get(sessionId) || {};
  const updated = {
    ...existing,
    ...updateData,
    id: sessionId,
    updatedAt: new Date().toISOString()
  };
  mockSessionsStore.set(sessionId, updated);
  return true;
}

/**
 * Gets a session document by ID
 * @param {string} sessionId 
 * @returns {Promise<import('../types.js').Session | null>}
 */
export async function getSession(sessionId) {
  if (db && !isMockFirebase) {
    try {
      const docRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.warn('[sessionService] Firestore getDoc failed:', err.message);
    }
  }

  return mockSessionsStore.get(sessionId) || null;
}

/**
 * Retrieves all sessions for a given student
 * @param {string} studentId 
 * @returns {Promise<import('../types.js').Session[]>}
 */
export async function getStudentSessions(studentId) {
  if (db && !isMockFirebase) {
    try {
      const q = query(
        collection(db, 'sessions'), 
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[sessionService] Firestore query failed:', err.message);
    }
  }

  // Mock fallback
  return Array.from(mockSessionsStore.values())
    .filter(s => s.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Retrieves all sessions (for teacher dashboard)
 * @returns {Promise<import('../types.js').Session[]>}
 */
export async function getAllSessions() {
  if (db && !isMockFirebase) {
    try {
      const snapshot = await getDocs(collection(db, 'sessions'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[sessionService] Firestore getAllSessions failed:', err.message);
    }
  }

  return Array.from(mockSessionsStore.values());
}

// Privacy-safe daily unknown visits counter (number only: no photos, no descriptors)
let mockDailyUnknownVisits = 0;

export async function recordUnknownVisit() {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (db && !isMockFirebase) {
    try {
      const visitDocRef = doc(db, 'analytics', `unknown_visits_${todayKey}`);
      const snap = await getDoc(visitDocRef);
      if (snap.exists()) {
        await updateDoc(visitDocRef, {
          count: (snap.data().count || 0) + 1,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(visitDocRef, {
          date: todayKey,
          count: 1,
          updatedAt: serverTimestamp()
        });
      }
      return true;
    } catch (err) {
      console.warn('[sessionService] Firestore recordUnknownVisit failed:', err.message);
    }
  }

  mockDailyUnknownVisits++;
  return true;
}

export async function getDailyUnknownVisits() {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (db && !isMockFirebase) {
    try {
      const visitDocRef = doc(db, 'analytics', `unknown_visits_${todayKey}`);
      const snap = await getDoc(visitDocRef);
      if (snap.exists()) {
        return snap.data().count || 0;
      }
      return 0;
    } catch (err) {
      console.warn('[sessionService] Firestore getDailyUnknownVisits failed:', err.message);
    }
  }

  return mockDailyUnknownVisits;
}
