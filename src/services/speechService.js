/**
 * SMART WASH — Voice Guidance & Speech Synthesis Service
 * Handles multilingual TTS via pre-recorded neural audio files,
 * backend dynamic neural TTS fallback (/api/tts), and Web Speech API.
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

export function updateVoices() {
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
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
  }
}

/**
 * Returns a genuine matching voice for the target language.
 * Strict: Never returns an unrelated language voice for Malayalam.
 */
export function getVoiceForLanguage(lang) {
  updateVoices();
  const prefixes = VOICE_PREFIX_MAP[lang] || [lang];
  for (const prefix of prefixes) {
    const matched = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      const vName = (v.name || '').toLowerCase();
      return vLang.startsWith(prefix.toLowerCase()) || 
             (prefix === 'ml' && (vLang.includes('malayalam') || vName.includes('malayalam')));
    });
    if (matched) return matched;
  }
  return null;
}

/**
 * Checks whether a native TTS voice exists in the browser for the given language.
 */
export function hasVoiceForLanguage(lang) {
  return Boolean(getVoiceForLanguage(lang));
}

/**
 * Resolves the backend dynamic TTS endpoint across localhost dev, LAN, and Docker deployments.
 */
export function getTtsEndpoint(text, lang = 'ml') {
  const cleanText = encodeURIComponent(text || '');
  const cleanLang = encodeURIComponent(lang || 'ml');

  if (typeof window === 'undefined') {
    return `http://localhost:4550/api/tts?text=${cleanText}&lang=${cleanLang}`;
  }

  // Configured production backend URL takes top precedence
  if (import.meta.env?.VITE_API_URL) {
    const baseUrl = String(import.meta.env.VITE_API_URL).trim().replace(/\/$/, '');
    return `${baseUrl}/api/tts?text=${cleanText}&lang=${cleanLang}`;
  }
  if (window.__SMARTWASH_CONFIG__?.apiUrl) {
    const baseUrl = String(window.__SMARTWASH_CONFIG__.apiUrl).trim().replace(/\/$/, '');
    return `${baseUrl}/api/tts?text=${cleanText}&lang=${cleanLang}`;
  }

  const hostname = window.location?.hostname || 'localhost';
  const port = window.location?.port;

  // Behind reverse proxy (port 80 or 443)
  if (!port || port === '80' || port === '443') {
    return `/api/tts?text=${cleanText}&lang=${cleanLang}`;
  }

  // Direct backend port 4550 (with fallback to proxy if same-origin)
  return `http://${hostname}:4550/api/tts?text=${cleanText}&lang=${cleanLang}`;
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
      currentAudio.src = '';
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
 * Attempts to play an audio file (pre-recorded MP3 or backend TTS stream).
 */
export function tryPlayAudioFile(url, speechId) {
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
      if (currentSpeechId === speechId) {
        resolve(true);
      } else {
        resolve(false);
      }
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
    }, 4000);

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
 * Plays speech using Web Speech API SpeechSynthesis.
 */
function speakWebSpeech(text, lang, speechId, onEnd = null) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd && currentSpeechId === speechId) onEnd();
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
      if (onEnd && currentSpeechId === speechId) onEnd();
      resolve(false);
    }
  });
}

/**
 * Plays speech using the backend dynamic neural TTS endpoint.
 */
async function speakDynamicBackendTts(text, lang, speechId, onEnd = null) {
  const url = getTtsEndpoint(text, lang);
  try {
    const ok = await tryPlayAudioFile(url, speechId);
    if (currentSpeechId === speechId && ok && onEnd) {
      onEnd();
    }
    return ok;
  } catch (err) {
    console.warn(`[SpeechService] Dynamic backend TTS unavailable for ${lang}:`, err.message);
    return false;
  }
}

/**
 * Main speak helper:
 * 1. Tries pre-recorded audio from /audio/{lang}/{key}.mp3.
 * 2. If missing or customText:
 *    - Uses native WebSpeech if browser has matching voice.
 *    - Otherwise uses dynamic neural TTS via backend (/api/tts).
 * 3. Never speaks Malayalam with a substitute Hindi/English voice.
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

  // If this is a standard prompt (not arbitrary custom text), try pre-recorded MP3 first
  const isCustom = Boolean(customText) || textKey === 'custom_speech';
  if (!isCustom && textKey) {
    const audioUrl = `/audio/${lang}/${textKey}.mp3`;
    try {
      const played = await tryPlayAudioFile(audioUrl, speechId);
      if (currentSpeechId === speechId && played) {
        if (onEnd) onEnd();
        return true;
      }
    } catch {
      // Pre-recorded audio missing or error, continue to fallback
    }
  }

  if (currentSpeechId !== speechId) return false;

  // Check if browser has a native voice for this language
  const hasVoice = hasVoiceForLanguage(lang);

  if (hasVoice) {
    // Native voice available in browser (e.g. English or Hindi on Windows)
    const success = await speakWebSpeech(spokenText, lang, speechId, onEnd);
    if (success) return true;
  }

  // Fallback: If no browser voice (e.g. Malayalam on Windows) or WebSpeech failed,
  // use backend dynamic neural TTS endpoint
  if (currentSpeechId === speechId) {
    const backendSuccess = await speakDynamicBackendTts(spokenText, lang, speechId, onEnd);
    if (backendSuccess) return true;
  }

  // If both pre-recorded audio and backend TTS are unavailable, and no browser voice exists,
  // do NOT feed Malayalam text to a non-Malayalam voice (e.g. Hindi/English voice)
  if (!hasVoice) {
    console.warn(`[SpeechService] No native or backend TTS voice available for ${lang}. Suppressed mispronunciation.`);
    if (onEnd && currentSpeechId === speechId) onEnd();
    return false;
  }

  if (onEnd && currentSpeechId === speechId) onEnd();
  return false;
}

/**
 * Plays the language selection prompt sequentially in English, Malayalam, and Hindi.
 */
export async function playLanguageSelectionSequence(onComplete = null) {
  cancelSpeech();
  const sequenceId = ++currentSpeechId;

  const sequence = [
    { lang: 'en', key: 'choose_language_prompt' },
    { lang: 'ml', key: 'choose_language_prompt' },
    { lang: 'hi', key: 'choose_language_prompt' }
  ];

  for (const item of sequence) {
    if (currentSpeechId !== sequenceId) return; // Terminated early by user action

    await new Promise((resolve) => {
      speak(item.key, item.lang, null, resolve);
      // Failsafe timer so sequence advances even if speech synthesis does not trigger onend
      setTimeout(resolve, 2500);
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
  getTtsEndpoint,
  playLanguageSelectionSequence
};
