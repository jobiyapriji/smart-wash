import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { updateStudent } from '../../../../shared/services/studentService.js';
import { getStudentSessions } from '../../../../shared/services/sessionService.js';
import { calculateStreak } from '../../../../shared/services/scoringService.js';
import { ArrowLeft, Camera, RefreshCw, Check, AlertCircle, Flame, Award, Calendar } from 'lucide-react';

export function StudentProfile({ students = [], refreshData }) {
  const { studentId } = useParams();
  const student = students.find(s => s.studentId === studentId);
  
  const [sessions, setSessions] = useState([]);
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (student) {
      getStudentSessions(studentId).then(setSessions);
    }
  }, [student, studentId]);

  if (!student) {
    return (
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '32px',
        border: '2px solid #1E293B',
        boxShadow: '4px 4px 0px 0px #1E293B',
        textAlign: 'center',
        fontFamily: 'Outfit, sans-serif'
      }}>
        <h3 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>Student not found.</h3>
        <Link to="/teacher/students" style={{ color: '#8B5CF6', fontWeight: 800, marginTop: '8px', display: 'inline-block' }}>
          ← Back to Student Roster
        </Link>
      </div>
    );
  }

  const startCamera = async () => {
    setIsReEnrolling(true);
    setCapturedPhoto(null);
    setExtractedDescriptor(null);
    setError(null);
    setSuccess(false);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureAndExtract = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setError(null);

    try {
      const video = videoRef.current;
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) throw new Error("No face detected.");
      if (detections.length > 1) throw new Error("Multiple faces detected.");

      const descriptor = Array.from(detections[0].descriptor);
      setExtractedDescriptor(descriptor);

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      
      stopCamera();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveReEnrollment = async () => {
    if (!extractedDescriptor || !capturedPhoto) return;
    setIsProcessing(true);
    try {
      await updateStudent(studentId, {
        descriptor: extractedDescriptor,
        photoBase64: capturedPhoto
      });
      setSuccess(true);
      setIsReEnrolling(false);
      if (refreshData) refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const avgScore = sessions.length > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + (s.complianceScore ?? s.score ?? 0), 0) / sessions.length) 
    : 'N/A';
  const currentStreak = calculateStreak(sessions);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* Left Column: Profile Sticker Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '28px',
        border: '2.5px solid #1E293B',
        boxShadow: '4px 4px 0px 0px #1E293B',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <Link
            to="/teacher/students"
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '2px solid #1E293B',
              background: '#FFFDF5',
              color: '#1E293B',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '2px 2px 0 0 #1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            <span>Back to Roster</span>
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={student.name}
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                objectFit: 'cover',
                marginBottom: '14px',
                border: '3px solid #1E293B',
                boxShadow: '3px 3px 0 0 #1E293B'
              }}
            />
          ) : (
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: '#8B5CF6',
              border: '3px solid #1E293B',
              boxShadow: '3px 3px 0 0 #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '44px',
              fontWeight: 900,
              color: '#FFFFFF',
              marginBottom: '14px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {student.name.charAt(0)}
            </div>
          )}

          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            {student.name}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#8B5CF6', fontWeight: 800, fontFamily: 'Outfit, monospace, sans-serif' }}>
            {student.studentId}
          </p>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <span style={{
              background: '#FEF3C7',
              border: '1.5px solid #1E293B',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {student.className || 'Grade 5'}
            </span>
            <span style={{
              background: '#D1FAE5',
              border: '1.5px solid #1E293B',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}>
              Sec {student.section || 'A'}
            </span>
          </div>
        </div>

        {/* Biometric Re-enrollment Section */}
        <div style={{ borderTop: '2px solid #E2E8F0', paddingTop: '20px', marginTop: 'auto' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Outfit, sans-serif' }}>
            BIOMETRIC FACE DATA
          </h3>
          
          {!isReEnrolling ? (
            <button
              onClick={startCamera}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: '#FFFDF5',
                border: '2px solid #1E293B',
                boxShadow: '3px 3px 0 0 #1E293B',
                color: '#1E293B',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <RefreshCw size={15} strokeWidth={2.5} />
              <span>Re-enroll Face Descriptor</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: '#090D16',
                borderRadius: '16px 16px 16px 4px',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                border: '2.5px solid #1E293B',
                boxShadow: '3px 3px 0 0 #1E293B'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    display: stream && !capturedPhoto ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                  }}
                />
                {capturedPhoto && (
                  <img src={capturedPhoto} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              
              {error && (
                <div style={{ color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>
                  ⚠️ {error}
                </div>
              )}
              
              {stream && !capturedPhoto && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={captureAndExtract}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#34D399',
                      color: '#1E293B',
                      border: '2px solid #1E293B',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    {isProcessing ? 'Analyzing Face...' : '📸 Capture Face'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setIsReEnrolling(false);
                      setError(null);
                    }}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 14px',
                      background: '#F1F5F9',
                      color: '#1E293B',
                      border: '2px solid #1E293B',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {capturedPhoto && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={saveReEnrollment}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#8B5CF6',
                      color: '#FFFFFF',
                      border: '2px solid #1E293B',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    {isProcessing ? 'Saving...' : 'Save Descriptor'}
                  </button>
                  <button
                    onClick={startCamera}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 14px',
                      background: '#FFFDF5',
                      color: '#1E293B',
                      border: '2px solid #1E293B',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setIsReEnrolling(false);
                      setCapturedPhoto(null);
                      setError(null);
                    }}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 14px',
                      background: '#F1F5F9',
                      color: '#1E293B',
                      border: '2px solid #1E293B',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          {success && (
            <div style={{
              color: '#059669',
              fontSize: '12px',
              fontWeight: 800,
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Check size={14} strokeWidth={3} />
              <span>Face updated successfully!</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Stats & Session History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Stat Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            padding: '18px',
            border: '2px solid #1E293B',
            boxShadow: '3px 3px 0 0 #1E293B'
          }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>
              Average Score
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1E293B', marginTop: '4px', fontFamily: 'Outfit, sans-serif' }}>
              {avgScore}
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            padding: '18px',
            border: '2px solid #1E293B',
            boxShadow: '3px 3px 0 0 #1E293B'
          }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>
              Total Sessions
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#8B5CF6', marginTop: '4px', fontFamily: 'Outfit, sans-serif' }}>
              {sessions.length}
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            padding: '18px',
            border: '2.5px solid #1E293B',
            boxShadow: '3px 3px 0 0 #1E293B'
          }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>
              Current Streak
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 900,
              color: currentStreak > 0 ? '#F59E0B' : '#94A3B8',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              <span>{currentStreak}</span>
              <Flame
                size={22}
                color={currentStreak > 0 ? '#F59E0B' : '#94A3B8'}
                fill={currentStreak > 0 ? '#F59E0B' : 'none'}
              />
            </div>
          </div>
        </div>

        {/* Sessions Table Sticker Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0 0 #1E293B',
          flex: 1
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            Session History
          </h3>
          
          {sessions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1E293B', background: '#FFFDF5', color: '#1E293B', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Date</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Score</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr
                      key={s.id || s.sessionId}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px', color: '#1E293B', fontWeight: 600 }}>
                        {new Date(s.timestamp?.seconds ? s.timestamp.seconds * 1000 : (s.timestamp || Date.now())).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
                        {(() => {
                          const scoreVal = s.complianceScore ?? s.score ?? 0;
                          return (
                            <span style={{
                              background: scoreVal >= 80 ? '#D1FAE5' : (scoreVal >= 70 ? '#FEF3C7' : '#FEE2E2'),
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              border: '1.5px solid #1E293B'
                            }}>
                              {scoreVal} / 100
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: s.status === 'completed' ? '#D1FAE5' : (s.status === 'abandoned' ? '#FEE2E2' : '#F1F5F9'),
                          color: '#1E293B',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid #CBD5E1',
                          textTransform: 'capitalize'
                        }}>
                          {s.status || 'completed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: '14px', fontWeight: 600, padding: '20px 0', textAlign: 'center' }}>
              No sessions recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentProfile;
