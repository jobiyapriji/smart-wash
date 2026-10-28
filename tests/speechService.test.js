import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  speak,
  cancelSpeech,
  getVoiceForLanguage,
  hasVoiceForLanguage,
  getTtsEndpoint,
  playLanguageSelectionSequence
} from '../src/services/speechService.js';
import { translations, en } from '../src/i18n/translations.js';

describe('SpeechService & Multilingual Voice Guidance', () => {
  beforeEach(() => {
    cancelSpeech();
    vi.restoreAllMocks();
  });

  describe('1. Malayalam Unicode Text Verification', () => {
    it('all 15 Malayalam audio keys contain genuine Malayalam Unicode characters', () => {
      const audioKeys = [
        'choose_language_prompt',
        'welcome_audio',
        'step_1_audio',
        'step_2_audio',
        'step_3_audio',
        'step_4_audio',
        'step_5_audio',
        'step_6_audio',
        'step_complete_audio',
        'keep_scrubbing_audio',
        'wash_finished_audio',
        'encouragement_excellent_audio',
        'encouragement_good_audio',
        'encouragement_practice_audio',
        'unknown_person_audio'
      ];

      const malayalamRegex = /[\u0D00-\u0D7F]/; // Malayalam Unicode block

      audioKeys.forEach(key => {
        const mlText = translations.ml[key];
        expect(mlText, `Missing Malayalam key: ${key}`).toBeDefined();
        expect(typeof mlText).toBe('string');
        expect(malayalamRegex.test(mlText), `Key ${key} does not contain Malayalam Unicode text: "${mlText}"`).toBe(true);
      });
    });

    it('Malayalam text is not accidentally populated with English or Hindi text', () => {
      expect(translations.ml.step_1_audio).not.toBe(translations.en.step_1_audio);
      expect(translations.ml.step_1_audio).not.toBe(translations.hi.step_1_audio);
      expect(translations.ml.welcome_audio).toContain('സ്വാഗതം');
    });
  });

  describe('2. Voice Selection and Language Matcher', () => {
    it('returns null for Malayalam when browser voices do not include ml-IN voice', () => {
      // Mock window.speechSynthesis with only English and Hindi voices (standard Windows desktop environment)
      const mockVoices = [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Kalpana - Hindi (India)', lang: 'hi-IN' }
      ];

      globalThis.window = {
        speechSynthesis: {
          getVoices: () => mockVoices,
          cancel: vi.fn(),
          speak: vi.fn()
        }
      };

      const mlVoice = getVoiceForLanguage('ml');
      expect(mlVoice).toBeNull();
      expect(hasVoiceForLanguage('ml')).toBe(false);

      const enVoice = getVoiceForLanguage('en');
      expect(enVoice).not.toBeNull();
      expect(enVoice.lang).toBe('en-US');

      const hiVoice = getVoiceForLanguage('hi');
      expect(hiVoice).not.toBeNull();
      expect(hiVoice.lang).toBe('hi-IN');
    });

    it('strictly avoids selecting a Hindi or English voice as a substitute for Malayalam', () => {
      const mockVoices = [
        { name: 'Microsoft David Desktop', lang: 'en-US' },
        { name: 'Microsoft Kalpana', lang: 'hi-IN' }
      ];

      globalThis.window = {
        speechSynthesis: {
          getVoices: () => mockVoices,
          cancel: vi.fn(),
          speak: vi.fn()
        }
      };

      const voice = getVoiceForLanguage('ml');
      expect(voice).toBeNull();
    });

    it('correctly detects a genuine Malayalam voice when one is present', () => {
      const mockVoices = [
        { name: 'Google മലയാളം', lang: 'ml-IN' },
        { name: 'Microsoft David Desktop', lang: 'en-US' }
      ];

      globalThis.window = {
        speechSynthesis: {
          getVoices: () => mockVoices,
          cancel: vi.fn(),
          speak: vi.fn()
        }
      };

      const voice = getVoiceForLanguage('ml');
      expect(voice).not.toBeNull();
      expect(voice.lang).toBe('ml-IN');
      expect(hasVoiceForLanguage('ml')).toBe(true);
    });
  });

  describe('3. Dynamic Backend TTS URL Generation', () => {
    it('constructs correct /api/tts endpoint with properly encoded query parameters', () => {
      const testText = 'കൈകൾ ഉരസൂ';
      const endpoint = getTtsEndpoint(testText, 'ml');
      expect(endpoint).toContain('/api/tts');
      expect(endpoint).toContain('text=' + encodeURIComponent(testText));
      expect(endpoint).toContain('lang=ml');
    });
  });

  describe('4. Cancel and Interruption Logic', () => {
    it('cancelSpeech immediately stops HTML5 audio and cancels window.speechSynthesis', () => {
      const cancelMock = vi.fn();
      globalThis.window = {
        speechSynthesis: {
          getVoices: () => [],
          cancel: cancelMock,
          speak: vi.fn()
        }
      };

      cancelSpeech();
      expect(cancelMock).toHaveBeenCalled();
    });
  });
});
