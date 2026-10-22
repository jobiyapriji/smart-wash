/**
 * SMART WASH — Voice Guidance & Speech Synthesis Service
 * Handles multilingual TTS via Web Speech API with automatic pre-recorded MP3 fallback.
 * 
 * Target Languages:
 *   - English (en-IN)
 *   - Malayalam (ml-IN)
 *   - Hindi (hi-IN)
 */

import { translations, en as enTranslations } from '../i18n/translations.js';

let voices = [];
let voicesLoaded = false;
let currentAudio = null;
let currentSpeechId = 0;
const failedAudioUrls = new Set();

const LANG_CODE_MAP = {
  en: 'en-IN',
  ml: 'ml-IN',
  hi: 'hi-IN'
};

const VOICE_PREFIX_MAP = {
  en: ['en-in', 'en-gb', 'en-us', 'en'],
  hi: ['hi-in', 'hi'],
  ml: ['ml-in', 'ml']
};

function updateVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length > 0) {
      voices = list;
      voicesLoaded = true;
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

export function getVoiceForLanguage(lang) {
  updateVoices();
  const prefixes = VOICE_PREFIX_MAP[lang] || [lang];
  for (const prefix of prefixes) {
    const matched = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang.startsWith(prefix.toLowerCase());
    });
    if (matched) return matched;
  }
  return null;
}

export function hasVoiceForLanguage(lang) {
  return Boolean(getVoiceForLanguage(lang));
}

/**
 * Cancels all ongoing audio and Web Speech synthesis immediately.
 */
export function cancelSpeech() {
  currentSpeechId++;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // Ignored
    }
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignored
    }
  }
}

/**
 * Attempts to play pre-recorded MP3 file.
 */
function tryPlayAudioFile(url, speechId) {
  return new Promise((resolve, reject) => {
    if (failedAudioUrls.has(url)) {
      return reject(new Error('Audio URL previously failed'));
    }

    const audio = new Audio();
    audio.preload = 'auto';
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };

    const onEnded = () => {
      cleanup();
      if (currentAudio === audio) currentAudio = null;
      resolve(true);
    };

    const onError = (err) => {
      cleanup();
      failedAudioUrls.add(url);
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Timeout in case server hangs or responds slowly
    const timer = setTimeout(() => {
      if (!settled && audio.readyState < 2) {
        onError(new Error('Audio load timed out'));
      }
    }, 1200);

    audio.src = url;
    currentAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => clearTimeout(timer))
        .catch(err => {
          clearTimeout(timer);
          onError(err);
        });
    }
  });
}

/**
 * Fallback to Web Speech API.
 */
function speakWebSpeech(text, lang, speechId, onEnd = null) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return resolve(false);
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG_CODE_MAP[lang] || 'en-IN';
      
      const voice = getVoiceForLanguage(lang);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      utterance.onend = () => {
        if (currentSpeechId === speechId) {
          if (onEnd) onEnd();
          resolve(true);
        }
      };

      utterance.onerror = () => {
        if (currentSpeechId === speechId) {
          if (onEnd) onEnd();
          resolve(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SpeechService] WebSpeech invocation failed:', err);
      if (onEnd) onEnd();
      resolve(false);
    }
  });
}

/**
 * Main speak helper:
 * Tries pre-recorded audio first from /audio/{lang}/{key}.mp3.
 * Falls back to Web Speech API using window.speechSynthesis.
 * 
 * @param {string} textKey Translation key or audio filename key
 * @param {string} lang 'en' | 'ml' | 'hi'
 * @param {string} customText Optional override for speech text
 * @param {function} onEnd Optional callback when audio finishes
 */
export async function speak(textKey, lang = 'en', customText = null, onEnd = null) {
  cancelSpeech();
  const speechId = ++currentSpeechId;

  // Resolve text for speech
  const langTable = translations[lang] || enTranslations;
  const spokenText = customText || langTable[textKey] || enTranslations[textKey] || textKey;

  const audioUrl = `/audio/${lang}/${textKey}.mp3`;

  try {
    await tryPlayAudioFile(audioUrl, speechId);
    if (currentSpeechId === speechId && onEnd) {
      onEnd();
    }
    return true;
  } catch {
    // If pre-recorded audio does not exist or fails, fall back to Web Speech
    if (currentSpeechId === speechId) {
      return await speakWebSpeech(spokenText, lang, speechId, onEnd);
    }
  }
  return false;
}

/**
 * Plays the language selection prompt sequentially in English, Malayalam, and Hindi.
 */
export async function playLanguageSelectionSequence(onComplete = null) {
  cancelSpeech();
  const sequenceId = ++currentSpeechId;

  const sequence = [
    { lang: 'en', key: 'choose_language_prompt', text: 'Choose your language' },
    { lang: 'ml', key: 'choose_language_prompt', text: 'ഭാഷ തിരഞ്ഞെടുക്കുക' },
    { lang: 'hi', key: 'choose_language_prompt', text: 'अपनी भाषा चुनें' }
  ];

  for (const item of sequence) {
    if (currentSpeechId !== sequenceId) return; // Terminated early by user action

    await new Promise((resolve) => {
      speak(item.key, item.lang, item.text, resolve);
      // Failsafe timer so sequence advances even if speech synthesis does not trigger onend
      setTimeout(resolve, 2200);
    });

    // Brief gap between languages
    await new Promise(r => setTimeout(r, 250));
  }

  if (currentSpeechId === sequenceId && onComplete) {
    onComplete();
  }
}

export default {
  speak,
  cancelSpeech,
  getVoiceForLanguage,
  hasVoiceForLanguage,
  playLanguageSelectionSequence
};
