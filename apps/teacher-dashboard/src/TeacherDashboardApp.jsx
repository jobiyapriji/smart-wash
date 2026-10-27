import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ComplianceTrendChart } from './components/ComplianceTrendChart.jsx';
import { StudentLeaderboard } from './components/StudentLeaderboard.jsx';
import { StudentManagementList } from './components/StudentManagementList.jsx';
import { StudentEnrollmentForm } from './components/StudentEnrollmentForm.jsx';
import { StudentProfile } from './components/StudentProfile.jsx';
import { getAllStudents } from '../../../shared/services/studentService.js';
import { getAllSessions, getDailyUnknownVisits } from '../../../shared/services/sessionService.js';
import { calculateStreak } from '../../../shared/services/scoringService.js';
import { isMockFirebase } from '../../../shared/firebaseConfig.js';
import { LoadingPage } from '../../../src/components/LoadingPage.jsx';

import { Confetti } from '../../../src/components/ui/Confetti.jsx';
import { Button } from '../../../src/components/ui/Button.jsx';
import { Card } from '../../../src/components/ui/Card.jsx';
import { IconBadge } from '../../../src/components/ui/IconBadge.jsx';
import {
  GraduationCap,
  Sparkles,
  Users,
  CheckCircle2,
  Calendar,
  LogOut,
  ArrowLeft,
  Lock,
  Mail,
  Home,
  BarChart3,
  UserCheck
} from 'lucide-react';

function OverviewDashboard({ students, sessions, avgClassScore, unknownVisits = 0 }) {
  const compliantSessions = sessions.filter(s => (s.complianceScore ?? s.score ?? 0) >= 70);
  const complianceRate = sessions.length > 0 
    ? Math.round((compliantSessions.length / sessions.length) * 100)
    : null;

  // Compute daily averages for Trend Chart
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
  sessions.forEach(s => {
    const d = s.timestamp?.seconds ? new Date(s.timestamp.seconds * 1000) : new Date(s.timestamp || Date.now());
    const day = dayNames[d.getDay()];
    if (dayBuckets[day]) {
      dayBuckets[day].push(s.complianceScore ?? s.score ?? 0);
    }
  });

  const hasSessionData = Object.values(dayBuckets).some(arr => arr.length > 0);
  const trendData = hasSessionData ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
    const scores = dayBuckets[day];
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { day, avgScore };
  }) : undefined;

  return (
    <>
      {/* 5 Overview Stat Cards as Stickers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Stat 1: Class Average Score */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '22px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px, -2px) rotate(-0.5deg)';
          e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
              Class Avg Score
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#D1FAE5',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={16} strokeWidth={2.5} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: '#1E293B', margin: '8px 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>
            {avgClassScore}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1E293B',
            fontWeight: 800,
            background: '#D1FAE5',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid #1E293B',
            alignSelf: 'flex-start',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {avgClassScore !== 'N/A' ? 'Verified average' : 'No sessions recorded'}
          </div>
        </div>

        {/* Stat 2: Active Students */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '22px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px, -2px) rotate(0.5deg)';
          e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
              Active Students
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#EDE9FE',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={16} strokeWidth={2.5} color="#8B5CF6" />
            </div>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: '#1E293B', margin: '8px 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>
            {students.length}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1E293B',
            fontWeight: 800,
            background: '#EDE9FE',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid #1E293B',
            alignSelf: 'flex-start',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {students.length > 0 
              ? `${Math.round((students.filter(s => s.descriptor || s.photoUrl).length / students.length) * 100)}% face enrolled`
              : '0 enrolled'}
          </div>
        </div>

        {/* Stat 3: Compliance Rate */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '22px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px, -2px) rotate(-0.5deg)';
          e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
              Compliance Rate
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FCE7F3',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={16} strokeWidth={2.5} color="#F472B6" />
            </div>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: '#1E293B', margin: '8px 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>
            {complianceRate !== null ? `${complianceRate}%` : 'N/A'}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1E293B',
            fontWeight: 800,
            background: '#FCE7F3',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid #1E293B',
            alignSelf: 'flex-start',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {complianceRate !== null ? 'WHO step compliance' : 'No sessions yet'}
          </div>
        </div>

        {/* Stat 4: Total Sessions */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '22px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px, -2px) rotate(0.5deg)';
          e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
              Total Sessions
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FEF3C7',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={16} strokeWidth={2.5} color="#D97706" />
            </div>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: '#1E293B', margin: '8px 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>
            {sessions.length}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1E293B',
            fontWeight: 800,
            background: '#FEF3C7',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid #1E293B',
            alignSelf: 'flex-start',
            fontFamily: 'Outfit, sans-serif'
          }}>
            All verified sessions
          </div>
        </div>

        {/* Stat 5: Unknown Visits */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '22px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px, -2px) rotate(-0.5deg)';
          e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
              Unknown Visits
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FEF3C7',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: 900
            }}>
              ❓
            </div>
          </div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: '#1E293B', margin: '8px 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>
            {unknownVisits}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1E293B',
            fontWeight: 800,
            background: '#FEF3C7',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid #1E293B',
            alignSelf: 'flex-start',
            fontFamily: 'Outfit, sans-serif'
          }}>
            Unenrolled today
          </div>
        </div>
      </div>

      {/* Main Grid: Trend Chart & Leaderboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <ComplianceTrendChart data={trendData} />
        <StudentLeaderboard students={students} />
      </div>
    </>
  );
}

export function TeacherDashboardApp() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('smartwash_teacher_auth') === 'true' ||
           (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auth') === 'true');
  });
  const [teacherEmail, setTeacherEmail] = useState('teacher@smartwash.edu');
  const [teacherPassword, setTeacherPassword] = useState('admin123');
  const [authError, setAuthError] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [unknownVisits, setUnknownVisits] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const location = useLocation();

  const handleExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      navigate('/');
    }, 450);
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (!teacherEmail.trim()) {
      setAuthError('Please enter your staff email address.');
      return;
    }
    if (!teacherPassword || teacherPassword.length < 4) {
      setAuthError('Password must be at least 4 characters.');
      return;
    }
    setAuthError('');
    setIsLoggingIn(true);
    setTimeout(() => {
      sessionStorage.setItem('smartwash_teacher_auth', 'true');
      setIsAuthenticated(true);
      setIsLoggingIn(false);
    }, 600);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('smartwash_teacher_auth');
    setIsAuthenticated(false);
  };

  const loadDashboardData = async () => {
    const rawStudentList = await getAllStudents();
    const studentList = rawStudentList.filter(st => !st.isTest);
    const rawSessionList = await getAllSessions();
    // Test mode sessions AND dry test mode sessions are NOT counted in teacher analytics or the leaderboard
    const sessionList = rawSessionList.filter(s => s.mode !== 'dry' && s.mode !== 'test');
    const visits = await getDailyUnknownVisits();
    setUnknownVisits(visits || 0);
    
    // Calculate accurate scores and streak for students based on their actual sessions
    const studentMap = studentList.map(st => {
      const studentSessions = sessionList.filter(s => s.studentId === st.studentId);
      const streak = calculateStreak(studentSessions);
      const totalSessions = studentSessions.length;
      let score = null;
      let grade = 'Not Started';
      if (totalSessions > 0) {
        const sum = studentSessions.reduce((acc, s) => acc + (s.complianceScore ?? s.score ?? 0), 0);
        score = Math.round(sum / totalSessions);
        grade = score >= 90 ? 'Excellent' : (score >= 75 ? 'Good' : 'Needs Practice');
      }
      return {
        ...st,
        score,
        totalSessions,
        streak,
        grade
      };
    });

    setStudents(studentMap);
    setSessions(sessionList);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const studentsWithScores = students.filter(s => s.score !== null && s.score !== undefined);
  const avgClassScore = studentsWithScores.length > 0
    ? Math.round(studentsWithScores.reduce((acc, s) => acc + s.score, 0) / studentsWithScores.length)
    : (sessions.length > 0
        ? Math.round(sessions.reduce((acc, s) => acc + (s.complianceScore ?? s.score ?? 0), 0) / sessions.length)
        : 'N/A');

  if (isLoggingIn) {
    return (
      <LoadingPage
        message="Logging in..."
        duration={500}
      />
    );
  }

  if (isExiting) {
    return (
      <LoadingPage
        message="Exiting..."
        duration={400}
      />
    );
  }

  // Teacher Login Screen - Centered Sticker Card on Dot Grid Page
  if (!isAuthenticated) {
    return (
      <div className="bg-dot-grid" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: 'relative',
        padding: '24px',
        overflow: 'hidden'
      }}>
        {/* Playful Confetti background elements */}
        <Confetti />

        {/* Centered Sticker Card */}
        <form onSubmit={handleLogin} style={{
          background: '#FFFFFF',
          padding: '44px 38px',
          borderRadius: '28px',
          width: '100%',
          maxWidth: '440px',
          border: '3px solid #1E293B',
          boxShadow: '8px 8px 0px 0px #1E293B',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          {/* Official Project Logo */}
          <img
            src="/assets/smart_wash_logo.png"
            alt="SMART WASH Logo"
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              border: '2.5px solid #1E293B',
              boxShadow: '4px 4px 0 0 #1E293B',
              objectFit: 'contain',
              background: '#FFFFFF',
              marginBottom: '20px'
            }}
          />
          
          <h2 style={{
            margin: '0 0 4px 0',
            fontSize: '28px',
            fontWeight: 800,
            textAlign: 'center',
            color: '#1E293B',
            fontFamily: 'Outfit, sans-serif'
          }}>
            Teacher Portal
          </h2>

          <div style={{
            color: '#8B5CF6',
            fontSize: '12px',
            fontWeight: 800,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '10px',
            fontFamily: 'Outfit, sans-serif'
          }}>
            Little hands, healthy habits
          </div>

          <p style={{
            margin: '0 0 24px 0',
            color: '#64748B',
            fontSize: '14px',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.5
          }}>
            Enter staff credentials to access compliance analytics & student records
          </p>

          {authError && (
            <div style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: '#FEE2E2',
              border: '2px solid #1E293B',
              color: '#1E293B',
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '18px',
              boxSizing: 'border-box',
              boxShadow: '3px 3px 0 0 #1E293B'
            }}>
              ⚠️ {authError}
            </div>
          )}

          {/* Email input following Input spec */}
          <div style={{ width: '100%', marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              color: '#1E293B',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: 'Outfit, sans-serif'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@smartwash.edu"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontSize: '14px',
                fontWeight: 600,
                outline: 'none',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B5CF6';
                e.target.style.boxShadow = '4px 4px 0px 0px #8B5CF6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password input following Input spec */}
          <div style={{ width: '100%', marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              color: '#1E293B',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: 'Outfit, sans-serif'
            }}>
              Password
            </label>
            <input
              type="password"
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontSize: '14px',
                fontWeight: 600,
                outline: 'none',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B5CF6';
                e.target.style.boxShadow = '4px 4px 0px 0px #8B5CF6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Violet Candy Button */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '9999px',
              border: '2.5px solid #1E293B',
              background: '#8B5CF6',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '4px 4px 0px 0px #1E293B',
              marginBottom: '16px',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translate(-2px, -2px)';
              e.currentTarget.style.boxShadow = '6px 6px 0px 0px #1E293B';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '4px 4px 0px 0px #1E293B';
            }}
          >
            Authenticate ➔
          </button>

          {/* Back to Portal Secondary Button */}
          <button
            type="button"
            onClick={handleExit}
            style={{
              background: 'transparent',
              border: '2px solid #1E293B',
              color: '#1E293B',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              transition: 'background 0.2s',
              fontFamily: 'Outfit, sans-serif'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#FBBF24'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            <span>Back to Mode Selection</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-dot-grid" style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--background)',
      color: 'var(--foreground)',
      padding: '24px 32px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      boxSizing: 'border-box'
    }}>
      {/* Ambient Playful Confetti */}
      <Confetti />

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        {/* Top Navigation Bar with tilted logo, bold links, violet pill CTA */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          background: '#FFFFFF',
          padding: '16px 24px',
          borderRadius: '24px',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Logo & Portal Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/assets/smart_wash_logo.png"
              alt="SMART WASH Logo"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                border: '2px solid #1E293B',
                boxShadow: '3px 3px 0 0 #1E293B',
                objectFit: 'contain',
                background: '#FFFFFF',
                flexShrink: 0
              }}
            />
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
                Little hands, healthy habits
              </span>
              <h1 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
                Teacher Handwashing Analytics
              </h1>
              {isMockFirebase && (
                <span style={{ marginTop: '4px', padding: '2px 6px', background: '#FEF3C7', border: '1px solid #1E293B', color: '#1E293B', fontSize: '9px', fontWeight: 800, borderRadius: '4px', display: 'inline-block' }}>
                  [LOCAL DEMO PERSISTENCE]
                </span>
              )}
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExit}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '2px solid #1E293B',
                background: '#FFFDF5',
                color: '#1E293B',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '2px 2px 0 0 #1E293B',
                fontFamily: 'Outfit, sans-serif'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FBBF24'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFFDF5'}
            >
              <Home size={14} strokeWidth={2.5} />
              <span>Modes</span>
            </button>

            <div style={{
              fontSize: '12px',
              color: '#1E293B',
              background: '#F1F5F9',
              padding: '6px 12px',
              borderRadius: '9999px',
              border: '1.5px solid #1E293B',
              fontWeight: 700
            }}>
              <span>{teacherEmail}</span>
            </div>

            <button
              onClick={handleSignOut}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '2px solid #1E293B',
                background: '#FEE2E2',
                color: '#1E293B',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '2px 2px 0 0 #1E293B',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <LogOut size={14} strokeWidth={2.5} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Tab Navigation Pill Strip */}
        <nav style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '28px',
          flexWrap: 'wrap'
        }}>
          <Link
            to="/teacher"
            style={{
              textDecoration: 'none',
              color: location.pathname === '/teacher' ? '#FFFFFF' : '#1E293B',
              fontWeight: 800,
              fontSize: '14px',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: location.pathname === '/teacher' ? '#8B5CF6' : '#FFFFFF',
              border: '2px solid #1E293B',
              boxShadow: location.pathname === '/teacher' ? '3px 3px 0 0 #1E293B' : '2px 2px 0 0 #CBD5E1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.15s ease'
            }}
          >
            <BarChart3 size={16} strokeWidth={2.5} />
            <span>Overview Analytics</span>
          </Link>

          <Link
            to="/teacher/students"
            style={{
              textDecoration: 'none',
              color: location.pathname.startsWith('/teacher/students') ? '#FFFFFF' : '#1E293B',
              fontWeight: 800,
              fontSize: '14px',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: location.pathname.startsWith('/teacher/students') ? '#8B5CF6' : '#FFFFFF',
              border: '2px solid #1E293B',
              boxShadow: location.pathname.startsWith('/teacher/students') ? '3px 3px 0 0 #1E293B' : '2px 2px 0 0 #CBD5E1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.15s ease'
            }}
          >
            <UserCheck size={16} strokeWidth={2.5} />
            <span>Student Management</span>
          </Link>
        </nav>

        {/* Routes Section */}
        <Routes>
          <Route path="/" element={
            <OverviewDashboard 
              students={students} 
              sessions={sessions} 
              avgClassScore={avgClassScore}
              unknownVisits={unknownVisits}
            />
          } />
          <Route path="/students" element={<StudentManagementList students={students} refreshData={loadDashboardData} />} />
          <Route path="/students/add" element={<StudentEnrollmentForm onEnrollmentSuccess={loadDashboardData} />} />
          <Route path="/students/:studentId" element={<StudentProfile students={students} refreshData={loadDashboardData} />} />
        </Routes>
      </div>
    </div>
  );
}

export default TeacherDashboardApp;
