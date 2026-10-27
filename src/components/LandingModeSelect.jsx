import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingPage } from './LoadingPage.jsx';
import { PageShell } from './ui/PageShell.jsx';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { Pill } from './ui/Pill.jsx';
import { IconBadge } from './ui/IconBadge.jsx';
import { Squiggle } from './ui/Squiggle.jsx';
import { Sparkles, ShieldCheck, Smartphone, ScanFace, Timer, Mic, BarChart3, Users, Award, Lock } from 'lucide-react';

export function LandingModeSelect() {
  const navigate = useNavigate();

  // Loading page before landing page
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Transition loading screen when navigating to student or teacher portal
  const [transitionLoading, setTransitionLoading] = useState({
    active: false,
    message: '',
    submessage: ''
  });

  const handleLaunchStudent = () => {
    setTransitionLoading({
      active: true,
      message: 'Launching Wash Station...',
      submessage: 'Connecting to sink vision stream & initializing 6 WHO step guide...'
    });
    setTimeout(() => {
      navigate('/student');
    }, 600);
  };

  const handleOpenTeacher = () => {
    setTransitionLoading({
      active: true,
      message: 'Opening Teacher Portal...',
      submessage: 'Securing administrative session & fetching hygiene analytics...'
    });
    setTimeout(() => {
      navigate('/teacher');
    }, 600);
  };

  // 1. Loading page before landing page
  if (isInitialLoading) {
    return (
      <LoadingPage
        message="Loading..."
        duration={1200}
        onComplete={() => setIsInitialLoading(false)}
      />
    );
  }

  // 2. Loading page whenever transitioning between modes
  if (transitionLoading.active) {
    return (
      <LoadingPage
        message={transitionLoading.message || 'Loading...'}
        duration={500}
      />
    );
  }

  return (
    <PageShell maxWidth="1100px">
      {/* Top Navbar */}
      <header
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-xl, 24px)',
          border: '2px solid var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          marginBottom: '48px',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Official Project Logo */}
          <img
            src="/assets/smart_wash_logo.png"
            alt="SMART WASH Logo"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-dark)',
              boxShadow: '3px 3px 0px 0px var(--border-dark)',
              objectFit: 'contain',
              background: '#FFFFFF',
              flexShrink: 0
            }}
          />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
              SMART WASH
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              Little hands, healthy habits
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* AI Ready Pill */}
          <Pill color="mint" icon={<ShieldCheck size={16} strokeWidth={2.5} />}>
            AI Engine Ready
          </Pill>
        </div>
      </header>

      {/* Hero Intro */}
      <div style={{ textAlign: 'center', maxWidth: '740px', marginBottom: '44px', zIndex: 1 }}>
        <div style={{ marginBottom: '14px' }}>
          <Pill color="violet" size="sm">
            Little hands, healthy habits
          </Pill>
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.15,
            margin: '0 0 10px 0',
            color: 'var(--foreground)',
            letterSpacing: '-0.03em'
          }}
        >
          Choose Your Mode to Begin
        </h1>

        {/* Decorative Squiggle Underline */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <Squiggle color="var(--secondary)" width="140px" height="16px" strokeWidth={4} />
        </div>

        <p
          style={{
            fontSize: 'clamp(15px, 2.5vw, 17px)',
            color: 'var(--muted-foreground)',
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 500
          }}
        >
          Select whether this device operates as the touchless washroom sink station or opens the administrative teacher analytics portal.
        </p>
      </div>

      {/* Two Mode Cards Grid */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          marginBottom: '48px',
          zIndex: 2
        }}
      >
        {/* Card 1: Student Kiosk Mode */}
        <Card
          headerStripColor="violet"
          shadowColor="violet"
          interactive={true}
          onClick={handleLaunchStudent}
          style={{
            padding: '36px 32px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '440px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
              <IconBadge
                icon={<Sparkles size={28} strokeWidth={2.5} />}
                color="violet"
                size="lg"
                shape="square"
              />
              <Pill color="mint" size="sm">
                Sink Display Mode
              </Pill>
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--foreground)' }}>
              Wash Station
            </h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              Zero-touch interactive mirror designed for touchscreens or mobile phones mounted at the sink. Autonomously recognizes students, guides 6 WHO steps, and verifies active hand movement.
            </p>

            {/* Feature Pills (Rotating Confetti Colors) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
              <Pill color="white" size="sm" icon={<Smartphone size={14} strokeWidth={2.5} />}>
                Phone / Tablet Ready
              </Pill>
              <Pill color="white" size="sm" icon={<ScanFace size={14} strokeWidth={2.5} />}>
                Touchless Face ID
              </Pill>
              <Pill color="white" size="sm" icon={<Timer size={14} strokeWidth={2.5} />}>
                6 WHO Steps
              </Pill>
              <Pill color="white" size="sm" icon={<Mic size={14} strokeWidth={2.5} />}>
                Voice Guide
              </Pill>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              handleLaunchStudent();
            }}
            style={{ width: '100%' }}
          >
            Launch Wash Station ➔
          </Button>
        </Card>

        {/* Card 2: Teacher Portal Mode */}
        <Card
          headerStripColor="pink"
          shadowColor="pink"
          interactive={true}
          onClick={handleOpenTeacher}
          style={{
            padding: '36px 32px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '440px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
              <IconBadge
                icon={<BarChart3 size={28} strokeWidth={2.5} />}
                color="pink"
                size="lg"
                shape="square"
              />
              <Pill color="pink" size="sm">
                Staff & Analytics
              </Pill>
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--foreground)' }}>
              Teacher Portal
            </h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              Administrative hygiene command center for educators. Monitor real-time class compliance scores, review individual student session histories, enroll face IDs via webcam, and inspect trends.
            </p>

            {/* Feature Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
              <Pill color="white" size="sm" icon={<Lock size={14} strokeWidth={2.5} />}>
                Staff Auth
              </Pill>
              <Pill color="white" size="sm" icon={<BarChart3 size={14} strokeWidth={2.5} />}>
                Compliance Trends
              </Pill>
              <Pill color="white" size="sm" icon={<Users size={14} strokeWidth={2.5} />}>
                Student Biometrics
              </Pill>
              <Pill color="white" size="sm" icon={<Award size={14} strokeWidth={2.5} />}>
                Class Leaderboard
              </Pill>
            </div>
          </div>

          <Button
            variant="pink"
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTeacher();
            }}
            style={{ width: '100%' }}
          >
            Open Teacher Portal ➔
          </Button>
        </Card>
      </div>

      {/* Operator Setup Guide Strip */}
      <footer
        className="sticker-card"
        style={{
          width: '100%',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <IconBadge color="amber" size="sm" shape="circle">
            💡
          </IconBadge>
          <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
            <strong>Phone Sink Setup Tip:</strong> Place your mobile phone in landscape or portrait 40–60 cm away from hands at eye/chest level.
          </span>
        </div>
        <Pill color="muted" size="sm">
          SMART WASH v2.5 · Playful Edition
        </Pill>
      </footer>
    </PageShell>
  );
}

export default LandingModeSelect;
