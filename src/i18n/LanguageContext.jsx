import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, en } from './translations.js';

export const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' }
];

export function LanguageProvider({ children, initialLang = null }) {
  const [lang, setLangState] = useState(() => {
    if (initialLang) return initialLang;
    try {
      const saved = localStorage.getItem('smartwash_lang');
      if (saved && translations[saved]) return saved;
    } catch {
      // localStorage may fail in private mode
    }
    return 'en';
  });

  const setLang = useCallback((newLang) => {
    if (!translations[newLang]) return;
    setLangState(newLang);
    try {
      localStorage.setItem('smartwash_lang', newLang);
    } catch (err) {
      console.warn('[LanguageProvider] Could not persist language:', err);
    }
  }, []);

  // As requested: all visual menu/UI text across the kiosk remains in English.
  // The selected language 'lang' is used for audio voice-over guidance.
  const t = useCallback((key, params = {}) => {
    let template = en[key] !== undefined ? en[key] : key;

    if (typeof template === 'string' && Object.keys(params).length > 0) {
      Object.entries(params).forEach(([paramKey, val]) => {
        template = template.replaceAll(`{${paramKey}}`, String(val));
      });
    }

    return template;
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if used outside Provider
    return {
      lang: 'en',
      setLang: () => {},
      t: (k, params = {}) => {
        let text = en[k] || k;
        if (typeof text === 'string' && Object.keys(params).length > 0) {
          Object.entries(params).forEach(([pKey, val]) => {
            text = text.replaceAll(`{${pKey}}`, String(val));
          });
        }
        return text;
      },
      languages: SUPPORTED_LANGUAGES
    };
  }
  return context;
}
