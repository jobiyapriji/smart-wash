import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { enrollStudent } from '../../../../shared/services/studentService.js';
import { Camera, Check, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export function StudentEnrollmentForm({ onEnrollmentSuccess }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    className: '',
    section: '',
    rollNumber: ''
  });

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error('Failed to load face models:', err);
        setError('Failed to load face recognition models.');
      }
    };
    loadModels();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCapturedPhoto(null);
      setExtractedDescriptor(null);
      setError(null);
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

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  const captureAndExtract = async () => {
    if (!videoRef.current || !isModelLoaded) return;
    setIsProcessing(true);
    setError(null);

    try {
      const video = videoRef.current;
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error("No face detected. Please look clearly at the camera.");
      }
      if (detections.length > 1) {
        throw new Error("Multiple faces detected! Please ensure only the student is in frame.");
      }

      // Exactly one face
      const descriptor = Array.from(detections[0].descriptor);
      setExtractedDescriptor(descriptor);

      // Capture photo to canvas (mirrored to match natural preview)
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoBase64);
      
      stopCamera();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.studentId || !formData.name) {
      setError("Student ID and Name are required.");
      return;
    }
    if (!extractedDescriptor || !capturedPhoto) {
      setError("You must capture a valid face photo first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await enrollStudent({
        ...formData,
        descriptor: extractedDescriptor,
        photoBase64: capturedPhoto
      });
      setSuccess(true);
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
      setTimeout(() => navigate('/teacher/students'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#1E293B',
    fontSize: '14px',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 800,
    color: '#1E293B',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: 'Outfit, sans-serif'
  };

  const handleInputFocus = (e) => {
    e.target.style.borderColor = '#8B5CF6';
    e.target.style.boxShadow = '4px 4px 0px 0px #8B5CF6';
  };

  const handleInputBlur = (e) => {
    e.target.style.borderColor = '#CBD5E1';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      padding: '32px',
      border: '2.5px solid #1E293B',
      boxShadow: '4px 4px 0px 0px #1E293B',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            Enroll New Student
          </h2>
          <p style={{ margin: '6px 0 0 0', color: '#64748B', fontSize: '14px', fontWeight: 500 }}>
            Register student profile and capture their biometric face descriptor for wash station authentication.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/teacher/students')}
          style={{
            padding: '8px 16px',
            borderRadius: '9999px',
            border: '2px solid #1E293B',
            background: '#FFFDF5',
            color: '#1E293B',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '2px 2px 0 0 #1E293B',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Back to Roster</span>
        </button>
      </div>

      {error && (
        <div style={{
          background: '#FEE2E2',
          border: '2px solid #1E293B',
          padding: '12px 18px',
          borderRadius: '16px',
          color: '#1E293B',
          marginBottom: '24px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '3px 3px 0px 0px #1E293B',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} strokeWidth={2.5} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          background: '#D1FAE5',
          border: '2px solid #1E293B',
          padding: '12px 18px',
          borderRadius: '16px',
          color: '#1E293B',
          marginBottom: '24px',
          fontSize: '13px',
          fontWeight: 800,
          boxShadow: '3px 3px 0px 0px #1E293B',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={16} strokeWidth={3} color="#059669" />
          <span>Student enrolled successfully! Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
        {/* Left Column: Input Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={labelStyle}>STUDENT ID *</label>
            <input
              type="text"
              value={formData.studentId}
              onChange={e => setFormData({...formData, studentId: e.target.value})}
              placeholder="e.g. STU_205"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>FULL NAME *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. John Doe"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>CLASS</label>
              <input
                type="text"
                value={formData.className}
                onChange={e => setFormData({...formData, className: e.target.value})}
                placeholder="e.g. Grade 5"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>SECTION</label>
              <input
                type="text"
                value={formData.section}
                onChange={e => setFormData({...formData, section: e.target.value})}
                placeholder="e.g. A"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>ROLL NUMBER</label>
            <input
              type="text"
              value={formData.rollNumber}
              onChange={e => setFormData({...formData, rollNumber: e.target.value})}
              placeholder="e.g. 12"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
        </div>

        {/* Right Column: Sticker Framed Webcam Capture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={labelStyle}>BIOMETRIC PHOTO CAPTURE *</label>
          
          <div style={{
            background: '#090D16',
            borderRadius: '24px 24px 24px 4px',
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            border: '3px solid #1E293B',
            boxShadow: '4px 4px 0px 0px #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {!stream && !capturedPhoto && (
              <button
                type="button"
                onClick={startCamera}
                style={{
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  background: '#8B5CF6',
                  color: '#FFFFFF',
                  border: '2px solid #1E293B',
                  boxShadow: '3px 3px 0 0 #1E293B',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                <Camera size={18} strokeWidth={2.5} />
                <span>Start Camera</span>
              </button>
            )}
            
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
              <img
                src={capturedPhoto}
                alt="Captured"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {stream && !capturedPhoto && (
            <button
              type="button"
              onClick={captureAndExtract}
              disabled={isProcessing || !isModelLoaded}
              style={{
                padding: '14px',
                borderRadius: '9999px',
                background: '#34D399',
                color: '#1E293B',
                border: '2px solid #1E293B',
                boxShadow: '3px 3px 0 0 #1E293B',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                fontFamily: 'Outfit, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Camera size={16} strokeWidth={2.5} />
              <span>{isProcessing ? 'Analyzing Face...' : 'Capture & Extract Descriptor'}</span>
            </button>
          )}

          {capturedPhoto && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                flex: 1,
                padding: '10px 14px',
                background: '#D1FAE5',
                border: '2px solid #1E293B',
                borderRadius: '12px',
                color: '#1E293B',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontFamily: 'Outfit, sans-serif'
              }}>
                <Check size={16} strokeWidth={3} color="#059669" />
                <span>Face Descriptor Ready</span>
              </div>
              <button
                type="button"
                onClick={startCamera}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: '#FFFDF5',
                  color: '#1E293B',
                  border: '2px solid #1E293B',
                  boxShadow: '2px 2px 0 0 #1E293B',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '13px',
                  fontFamily: 'Outfit, sans-serif',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} strokeWidth={2.5} />
                <span>Retake</span>
              </button>
            </div>
          )}
        </div>

        {/* Full width save button */}
        <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderTop: '2px solid #E2E8F0', paddingTop: '24px' }}>
          <button
            type="submit"
            disabled={isProcessing || success}
            style={{
              padding: '16px 32px',
              borderRadius: '9999px',
              background: '#8B5CF6',
              color: '#FFFFFF',
              border: '2.5px solid #1E293B',
              boxShadow: '4px 4px 0px 0px #1E293B',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '16px',
              width: '100%',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {isProcessing ? 'Processing Biometrics...' : 'Save & Enroll Student ➔'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StudentEnrollmentForm;
