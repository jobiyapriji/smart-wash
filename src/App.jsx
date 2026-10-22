import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingModeSelect } from './components/LandingModeSelect.jsx';
import { StudentKioskApp } from '../apps/student-app/src/StudentApp.jsx';
import { TeacherDashboardApp } from '../apps/teacher-dashboard/src/TeacherDashboardApp.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { LoadingProvider } from './context/LoadingContext.jsx';
import { LoadingPage } from './components/LoadingPage.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SMART WASH ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          background: 'var(--background)',
          color: 'var(--foreground)'
        }}>
          <div className="sticker-card" style={{ maxWidth: '480px', padding: '36px 32px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--secondary)',
              border: '2px solid var(--border-dark)',
              boxShadow: 'var(--shadow-pop)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px'
            }}>
              🧼
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--foreground)' }}>
              Kiosk Vision Recovered
            </h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
              The AI engine encountered a temporary video frame glitch. Click below to restart your session smoothly.
            </p>
            {this.state.error && (
              <div style={{
                padding: '10px 14px',
                background: '#FEE2E2',
                border: '2px solid #EF4444',
                borderRadius: 'var(--radius-sm)',
                color: '#991B1B',
                fontSize: '12px',
                marginBottom: '20px',
                fontFamily: 'monospace'
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn-candy-primary"
              style={{ width: '100%' }}
            >
              Restart Kiosk ➔
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="bg-dot-grid" style={{ minHeight: '100vh', color: 'var(--foreground)' }}>
      <ErrorBoundary>
        <LoadingProvider>
          <LanguageProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingPage message="Loading SMART WASH..." submessage="Preparing views and assets..." />}>
                <Routes>
                  <Route path="/" element={<LandingModeSelect />} />
                  <Route path="/student" element={<StudentKioskApp useMock={false} />} />
                  <Route path="/wash" element={<StudentKioskApp useMock={false} />} />
                  <Route path="/teacher/*" element={<TeacherDashboardApp />} />
                  <Route path="/login" element={<TeacherDashboardApp />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </LanguageProvider>
        </LoadingProvider>
      </ErrorBoundary>
    </div>
  );
}
