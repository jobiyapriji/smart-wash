/**
 * SMART WASH — Student & Face Descriptor Service
 * Owned by Jesty (Face ID + Backend)
 * 
 * Handles enrollment of students, storage of 128-d face descriptors,
 * and high-performance Euclidean distance vector matching.
 */

import { db, storage, isMockFirebase } from '../firebaseConfig.js';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

// Known legacy demo student IDs to purge if previously cached in localStorage
const DEMO_STUDENT_IDS = new Set(['STU_101', 'STU_102', 'STU_103']);

// In-memory store initialized from localStorage (clean by default, without hardcoded demo students)
const loadMockStudents = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('smartwash_mock_students');
      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map(parsed);
        // Automatically purge legacy hardcoded demo students (Alex River, Jordan Taylor, Sam Chen)
        let purged = false;
        for (const [id, s] of map.entries()) {
          if (DEMO_STUDENT_IDS.has(id) && (s.name === 'Alex River' || s.name === 'Jordan Taylor' || s.name === 'Sam Chen')) {
            map.delete(id);
            purged = true;
          }
        }
        if (purged) {
          localStorage.setItem('smartwash_mock_students', JSON.stringify(Array.from(map.entries())));
        }
        return map;
      }
    }
  } catch (e) {
    console.warn('Could not load mock students from localStorage', e);
  }
  return new Map();
};

const mockStudentsStore = loadMockStudents();

const saveMockStudents = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('smartwash_mock_students', JSON.stringify(Array.from(mockStudentsStore.entries())));
    }
  } catch (e) {
    console.warn('Could not save mock students to localStorage', e);
  }
};

/**
 * Calculates Euclidean distance between two 128-dimensional face feature vectors
 * @param {number[]} desc1 
 * @param {number[]} desc2 
 * @returns {number} distance (0.0 = identical, >0.6 usually distinct)
 */
export function calculateEuclideanDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) {
    return Infinity;
  }
  let sumSquare = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sumSquare += diff * diff;
  }
  return Math.sqrt(sumSquare);
}

/**
 * Matches an input face descriptor against enrolled students
 * @param {number[]} inputDescriptor - 128-float array
 * @param {import('../types.js').Student[]} enrolledStudents 
 * @param {number} threshold - Maximum Euclidean distance threshold (default: 0.6)
 * @returns {{ matchedStudent: import('../types.js').Student | null, distance: number, confidence: number }}
 */
export function matchFaceDescriptor(inputDescriptor, enrolledStudents = [], threshold = 0.6) {
  if (!inputDescriptor || inputDescriptor.length === 0 || enrolledStudents.length === 0) {
    return { matchedStudent: null, distance: Infinity, confidence: 0 };
  }

  let bestMatch = null;
  let minDistance = Infinity;

  for (const student of enrolledStudents) {
    if (!student.descriptor || !Array.isArray(student.descriptor)) continue;
    const distance = calculateEuclideanDistance(inputDescriptor, student.descriptor);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = student;
    }
  }

  if (minDistance <= threshold && bestMatch) {
    // Confidence formula: 100% at distance 0, dropping linearly to 0% at distance threshold
    const confidence = Math.max(0, Math.min(100, Math.round((1 - minDistance / threshold) * 100)));
    return { matchedStudent: bestMatch, distance: minDistance, confidence };
  }

  return { matchedStudent: null, distance: minDistance, confidence: 0 };
}

/**
 * Enrolls a new student in Firestore and optionally uploads a photo to Firebase Storage
 * @param {Object} studentData 
 * @param {string} [studentData.studentId]
 * @param {string} [studentData.name]
 * @param {string} [studentData.className]
 * @param {string} [studentData.section]
 * @param {string} [studentData.rollNumber]
 * @param {number[]} [studentData.descriptor]
 * @param {string} [studentData.photoBase64] - Data URL of the captured photo
 * @returns {Promise<boolean>}
 */
export async function enrollStudent(studentData) {
  if (!studentData.studentId || !studentData.name) {
    throw new Error('studentId and name are required for enrollment');
  }

  let photoUrl = studentData.photoUrl || '';

  if (db && !isMockFirebase) {
    try {
      // 1. Upload photo if provided
      if (studentData.photoBase64 && storage) {
        const photoRef = ref(storage, `students/${studentData.studentId}/profile.jpg`);
        await uploadString(photoRef, studentData.photoBase64, 'data_url');
        photoUrl = await getDownloadURL(photoRef);
      }

      const record = {
        studentId: studentData.studentId,
        name: studentData.name,
        className: studentData.className || '',
        section: studentData.section || '',
        rollNumber: studentData.rollNumber || '',
        descriptor: studentData.descriptor || [],
        photoUrl: photoUrl,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const studentRef = doc(db, 'students', studentData.studentId);
      await setDoc(studentRef, record);
      return true;
    } catch (err) {
      console.warn('[studentService] Firestore/Storage setDoc failed:', err.message);
    }
  }

  // Mock Mode
  const record = {
    ...studentData,
    photoUrl: studentData.photoBase64 || photoUrl, // Use base64 locally if mock
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockStudentsStore.set(studentData.studentId, record);
  saveMockStudents();
  return true;
}

/**
 * Updates an existing student's record (e.g. for re-enrollment)
 * @param {string} studentId 
 * @param {Object} updateData 
 */
export async function updateStudent(studentId, updateData) {
  if (!studentId) throw new Error('studentId is required for update');

  let photoUrl = updateData.photoUrl || '';

  if (db && !isMockFirebase) {
    try {
      if (updateData.photoBase64 && storage) {
        const photoRef = ref(storage, `students/${studentId}/profile.jpg`);
        await uploadString(photoRef, updateData.photoBase64, 'data_url');
        photoUrl = await getDownloadURL(photoRef);
      }

      const dataToUpdate = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      
      if (photoUrl) {
        dataToUpdate.photoUrl = photoUrl;
      }
      
      delete dataToUpdate.photoBase64; // Don't save base64 string to Firestore

      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, dataToUpdate);
      return true;
    } catch (err) {
      console.warn('[studentService] Firestore updateDoc failed:', err.message);
    }
  }

  // Mock mode
  const existing = mockStudentsStore.get(studentId) || {};
  const updated = {
    ...existing,
    ...updateData,
    photoUrl: updateData.photoBase64 || photoUrl || existing.photoUrl,
    updatedAt: new Date().toISOString()
  };
  delete updated.photoBase64;
  mockStudentsStore.set(studentId, updated);
  saveMockStudents();
  return true;
}

/**
 * Gets all enrolled students
 * @returns {Promise<import('../types.js').Student[]>}
 */
export async function getAllStudents() {
  if (db && !isMockFirebase) {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      // Return actual students stored in Firestore (empty array if no students enrolled)
      return snapshot.docs.map(doc => ({ studentId: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[studentService] Firestore getDocs failed, checking local store:', err.message);
    }
  }

  return Array.from(mockStudentsStore.values());
}

/**
 * Gets a student by ID
 * @param {string} studentId 
 * @returns {Promise<import('../types.js').Student | null>}
 */
export async function getStudentById(studentId) {
  if (db && !isMockFirebase) {
    try {
      const docRef = doc(db, 'students', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { studentId: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.warn('[studentService] Firestore getStudentById failed:', err.message);
    }
  }

  return mockStudentsStore.get(studentId) || null;
}

/**
 * Deletes a student record by studentId from the database (Firestore or local mock store).
 * Note: Historical wash sessions in 'sessions' collection are preserved for school compliance auditing.
 * @param {string} studentId 
 * @returns {Promise<boolean>}
 */
export async function deleteStudent(studentId) {
  if (!studentId || typeof studentId !== 'string') {
    throw new Error('Valid studentId is required for deletion');
  }

  if (db && !isMockFirebase) {
    try {
      const studentRef = doc(db, 'students', studentId);
      await deleteDoc(studentRef);
      return true;
    } catch (err) {
      console.error('[studentService] Firestore deleteDoc failed:', err.message);
      throw err;
    }
  }

  // Mock / Local store mode
  if (!mockStudentsStore.has(studentId)) {
    throw new Error(`Student with ID "${studentId}" was not found.`);
  }

  mockStudentsStore.delete(studentId);
  saveMockStudents();
  return true;
}

/**
 * Helper to reset in-memory student store during automated testing
 */
export function _resetMockStudentsForTesting() {
  mockStudentsStore.clear();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('smartwash_mock_students');
  }
}
