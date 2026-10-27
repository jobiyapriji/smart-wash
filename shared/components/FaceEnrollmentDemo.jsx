/**
 * SMART WASH — Face Recognition & Backend Verification Workbench
 * Owned by Jesty (Face ID + Backend)
 * 
 * Interactive component for testing face matching, student enrollment,
 * and automatic Firestore session creation.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useFaceRecognition } from '../hooks/useFaceRecognition.js';
import { createSession, getStudentSessions } from '../services/sessionService.js';
import { isMockFirebase } from '../firebaseConfig.js';

export function FaceEnrollmentDemo() {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  
  // Form state for enrollment
  const [newStudentId, setNewStudentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newClassId, setNewClassId] = useState('Grade 5-A');
  const [enrollMessage, setEnrollMessage] = useState('');

  const {
    enrolledStudents,
    matchedStudent,
    distance,
    confidence,
    isDetecting,
    simulateDetection,
    enrollCurrentFace
  } = useFaceRecognition({
    videoRef,
    enabled: cameraActive,
    distanceThreshold: 0.6
  });

  // Start webcam feed
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('[FaceEnrollmentDemo] Could not access webcam:', err.message);
      setCameraActive(false);
    }
  };

  // Stop webcam feed
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Handle student identification event -> create session in Firestore
  const handleStartSession = async (student) => {
    if (!student) return;
    try {
      const { id, session } = await createSession(student.studentId, student.name);
      setActiveSession(session);
      
      // Load session history for student
      const history = await getStudentSessions(student.studentId);
      setSessionHistory(history);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  // Handle enrollment submit
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!newStudentId || !newName) return;

    const success = await enrollCurrentFace({
      studentId: newStudentId,
      name: newName,
      classId: newClassId
    });

    if (success) {
      setEnrollMessage(`Successfully enrolled ${newName} (${newStudentId})!`);
      setNewStudentId('');
      setNewName('');
      setTimeout(() => setEnrollMessage(''), 4000);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: '1000px', margin: '0 auto', color: '#1e293b' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>
          🔐 SMART WASH — Face ID & Firestore Backend Workbench
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
          Jesty's Module Integration • Database Mode: <strong>{isMockFirebase ? 'Local Mock Mode' : 'Live Firebase Firestore'}</strong>
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Camera Feed & Recognition Status */}
        <section style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', marginTop: 0 }}>1. Live Face Camera Scan</h2>
          
          <div style={{ position: 'relative', width: '100%', height: '240px', backgroundColor: '#0f172a', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none', transform: 'scaleX(-1)' }} 
            />
            {!cameraActive && (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                <p style={{ margin: 0 }}>Camera feed inactive</p>
                <button 
                  onClick={startCamera} 
                  style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Start Camera Feed
                </button>
              </div>
            )}
            {cameraActive && isDetecting && (
              <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(37, 99, 235, 0.9)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                Scanning...
              </div>
            )}
          </div>

          {cameraActive && (
            <button 
              onClick={stopCamera} 
              style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Stop Camera
            </button>
          )}

          {/* Quick simulation buttons for testing */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>
              SIMULATE FACE MATCH (Offline / Demo Mode):
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {enrolledStudents.map(student => (
                <button
                  key={student.studentId}
                  onClick={() => {
                    simulateDetection(student.studentId);
                    handleStartSession(student);
                  }}
                  style={{ padding: '6px 12px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Detect {student.name}
                </button>
              ))}
            </div>
          </div>

          {/* Recognition Result Card */}
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', backgroundColor: matchedStudent ? '#f0fdf4' : '#fff', border: `1px solid ${matchedStudent ? '#bbf7d0' : '#cbd5e1'}` }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: matchedStudent ? '#15803d' : '#475569' }}>
              {matchedStudent ? '✅ Student Identified!' : '🔍 Searching for Face Match...'}
            </h3>
            {matchedStudent ? (
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                <div><strong>Name:</strong> {matchedStudent.name}</div>
                <div><strong>ID:</strong> {matchedStudent.studentId}</div>
                <div><strong>Match Confidence:</strong> {confidence}%</div>
                <button
                  onClick={() => handleStartSession(matchedStudent)}
                  style={{ marginTop: '10px', width: '100%', padding: '8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  🚀 Start Handwash Session in Firestore
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0' }}>
                Stand in front of the kiosk camera or select a test student above.
              </p>
            )}
          </div>
        </section>

        {/* Right Column: Enrollment & Firestore Session Verification */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Enrollment Form */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>2. Student Face Enrollment</h2>
            <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Student ID / Roll No:</label>
                <input 
                  type="text" 
                  value={newStudentId} 
                  onChange={e => setNewStudentId(e.target.value)} 
                  placeholder="e.g. STU_104" 
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Student Full Name:</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g. Maya Lin" 
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <button 
                type="submit" 
                style={{ marginTop: '6px', padding: '8px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                + Register & Save Descriptor
              </button>
            </form>
            {enrollMessage && (
              <p style={{ marginTop: '10px', padding: '8px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '6px', fontSize: '13px' }}>
                {enrollMessage}
              </p>
            )}
          </div>

          {/* Active Session Status */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>3. Active Firestore Session</h2>
            {activeSession ? (
              <div style={{ fontSize: '13px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div><strong>Session ID:</strong> <code>{activeSession.id}</code></div>
                <div><strong>Student:</strong> {activeSession.studentName} ({activeSession.studentId})</div>
                <div><strong>Status:</strong> {activeSession.status}</div>
                <div><strong>Steps Loaded:</strong> {activeSession.steps?.length} WHO steps</div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No active session created yet.</p>
            )}

            {sessionHistory.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px' }}>Past Sessions for Student:</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569' }}>
                  {sessionHistory.map(s => (
                    <li key={s.id}>
                      Session <code>{s.id}</code> — Score: {s.score} ({new Date(s.timestamp).toLocaleTimeString()})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
