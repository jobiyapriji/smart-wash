import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../../src/i18n/LanguageContext.jsx';
import { cancelSpeech, speak } from '../../../../src/services/speechService.js';
import { IconBadge } from '../../../../src/components/ui/IconBadge.jsx';
import { Squiggle } from '../../../../src/components/ui/Squiggle.jsx';
import { Volume2, Check } from 'lucide-react';

export function LanguageSelectView({ onSelectLanguage }) {
  const { lang, setLang } = useLanguage();
  const [countdown, setCountdown] = useState(15);
  const selectedRef = useRef(false);

  // Voiceover ONLY in the selected/default language in the beginning
  useEffect(() => {
    selectedRef.current = false;
    const initialLang = lang || 'en';
    speak('choose_language_prompt', initialLang);

    return () => {
      cancelSpeech();
    };
  }, []);

  // 15-second auto-default timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!selectedRef.current) {
            handleChoose(lang || 'en');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lang]);

  const handleChoose = (chosenLang) => {
    if (selectedRef.current) return;
    selectedRef.current = true;
    cancelSpeech();
    setLang(chosenLang);

    // Speak cheerful confirmation in the chosen language
    speak('welcome_audio', chosenLang);

    if (onSelectLanguage) {
      onSelectLanguage(chosenLang);
    }
  };

  // Three languages in three confetti colors
  const languageOptions = [
    {
      code: 'en',
      nativeLabel: 'English',
      englishSub: 'Default',
      flag: '🇬🇧',
      color: 'violet',
      bgColor: 'var(--accent)',
      textColor: '#FFFFFF',
      shadow: 'var(--shadow-pop)'
    },
    {
      code: 'ml',
      nativeLabel: 'മലയാളം',
      englishSub: 'Malayalam',
      flag: '🌴',
      color: 'mint',
      bgColor: 'var(--quaternary)',
      textColor: 'var(--foreground)',
      shadow: 'var(--shadow-pop)'
    },
    {
      code: 'hi',
      nativeLabel: 'हिन्दी',
      englishSub: 'Hindi',
      flag: '🪷',
      color: 'amber',
      bgColor: 'var(--tertiary)',
      textColor: 'var(--foreground)',
      shadow: 'var(--shadow-pop)'
    }
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '360px',
        padding: '24px 16px',
        gap: '24px',
        textAlign: 'center'
      }}
    >
      {/* Icon Badge & Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <IconBadge icon={<Volume2 size={28} strokeWidth={2.5} />} color="pink" size="lg" shape="circle" />
        <h2
          style={{
            margin: '8px 0 0',
            fontSize: '28px',
            fontWeight: 800,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em'
          }}
        >
          Choose Voice Language
        </h2>
        <Squiggle color="var(--tertiary)" width="100px" height="12px" />
        <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '14px', fontWeight: 500 }}>
          Audio step instructions will be spoken in your selected language
        </p>
      </div>

      {/* Three Big Confetti Pill Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '520px'
        }}
      >
        {languageOptions.map((opt) => {
          const isSelected = lang === opt.code;
          return (
            <button
              key={opt.code}
              id={`lang-select-btn-${opt.code}`}
              onClick={() => handleChoose(opt.code)}
              className="btn-candy"
              style={{
                backgroundColor: opt.bgColor,
                color: opt.textColor,
                border: '3px solid var(--border-dark)',
                borderRadius: 'var(--radius-full)',
                padding: '16px 14px',
                minHeight: '90px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: isSelected ? '6px 6px 0px 0px var(--border-dark)' : '4px 4px 0px 0px var(--border-dark)',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                cursor: 'pointer',
                transition: 'var(--transition-bounce)',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '20px' }}>{opt.flag}</div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  fontFamily: opt.code === 'ml' ? "'Noto Sans Malayalam', sans-serif" : opt.code === 'hi' ? "'Noto Sans Devanagari', sans-serif" : 'var(--font-heading)',
                  lineHeight: 1.2
                }}
              >
                {opt.nativeLabel}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 600 }}>
                {opt.englishSub}
              </div>

              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#1E293B',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    border: '2px solid #FFFFFF'
                  }}
                >
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Auto-continue countdown badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: '#FFFFFF',
          border: '2px solid var(--border-dark)',
          boxShadow: 'var(--shadow-pop-sm)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--foreground)'
        }}
      >
        <span>⏱️ Auto-continuing in</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--tertiary)',
            color: 'var(--foreground)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--border-dark)',
            fontFamily: 'monospace',
            fontWeight: 800
          }}
        >
          {countdown}s
        </span>
      </div>
    </div>
  );
}

export default LanguageSelectView;
