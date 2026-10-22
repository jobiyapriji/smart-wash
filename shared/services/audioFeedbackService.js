import { speak, cancelSpeech } from '../../src/services/speechService.js';
import { translations } from '../../src/i18n/translations.js';

export const WHO_AUDIO_PROMPTS = {
  1: "Step 1: Rub palms together thoroughly.",
  2: "Step 2: Rub right palm over left dorsum with interlaced fingers, and vice versa.",
  3: "Step 3: Palm to palm with fingers interlaced.",
  4: "Step 4: Backs of fingers to opposing palms with fingers interlocked.",
  5: "Step 5: Rotational rubbing of left thumb clasped in right palm and vice versa.",
  6: "Step 6: Rotational rubbing of fingertips backward and forward in palms."
};

/**
 * Speaks text using Web Speech API SpeechSynthesis or speechService.
 * @param {string} text 
 * @param {string} lang
 */
export function speakText(text, lang = 'en') {
  speak('custom_speech', lang, text);
}

/**
 * Speaks WHO step instruction prompt in selected language.
 * @param {number} stepNumber 
 * @param {string} lang
 */
export function speakStepInstruction(stepNumber, lang = 'en') {
  speak(`step_${stepNumber}_audio`, lang);
}

/**
 * Speaks score encouragement praise in selected language.
 * @param {number} score 
 * @param {string} studentName 
 * @param {string} lang
 */
export function speakEncouragement(score, studentName = '', lang = 'en') {
  const audioKey = score >= 85 
    ? 'encouragement_excellent_audio' 
    : score >= 70 
    ? 'encouragement_good_audio' 
    : 'encouragement_practice_audio';

  speak(audioKey, lang);
}

