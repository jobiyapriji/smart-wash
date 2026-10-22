import { describe, it, expect } from 'vitest';
import { en, ml, hi, translations } from '../src/i18n/translations.js';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from '../apps/student-app/src/studentStateMachine.js';

describe('i18n Translations Verification', () => {
  it('exports translations for en, ml, hi', () => {
    expect(translations.en).toBeDefined();
    expect(translations.ml).toBeDefined();
    expect(translations.hi).toBeDefined();
  });

  it('contains all 6 WHO steps with exact reference translations in Hindi', () => {
    expect(hi.step_1_name).toBe('हथेली से हथेली रगड़ें');
    expect(hi.step_2_name).toBe('दाएँ हाथ की हथेली से बाएँ हाथ का पिछला हिस्सा रगड़ें, फिर बदलें');
    expect(hi.step_3_name).toBe('उँगलियाँ आपस में फँसाकर हथेलियाँ रगड़ें');
    expect(hi.step_4_name).toBe('उँगलियों के पिछले हिस्से को दूसरी हथेली पर रगड़ें');
    expect(hi.step_5_name).toBe('अंगूठे को गोल घुमाकर रगड़ें');
    expect(hi.step_6_name).toBe('उँगलियों के सिरे हथेली में घुमाकर रगड़ें');
  });

  it('contains all 6 WHO steps with exact reference translations in Malayalam', () => {
    expect(ml.step_1_name).toBe('ഉള്ളങ്കൈകൾ തമ്മിൽ ഉരസുക');
    expect(ml.step_2_name).toBe('വലത്തേ കൈപ്പത്തി ഇടത്തേ കൈയുടെ പുറത്ത് ഉരസുക, പിന്നെ മാറ്റി ചെയ്യുക');
    expect(ml.step_3_name).toBe('വിരലുകൾ കോർത്തുപിടിച്ച് ഉള്ളങ്കൈകൾ ഉരസുക');
    expect(ml.step_4_name).toBe('വിരലുകളുടെ പുറംഭാഗം മറ്റേ കൈപ്പത്തിയിൽ ഉരസുക');
    expect(ml.step_5_name).toBe('തള്ളവിരൽ വട്ടത്തിൽ ഉരസുക');
    expect(ml.step_6_name).toBe('വിരൽത്തുമ്പുകൾ ഉള്ളങ്കൈയിൽ വട്ടത്തിൽ ഉരസുക');
  });

  it('has identical keys across en, ml, and hi', () => {
    const enKeys = Object.keys(en).sort();
    const mlKeys = Object.keys(ml).sort();
    const hiKeys = Object.keys(hi).sort();

    expect(mlKeys).toEqual(enKeys);
    expect(hiKeys).toEqual(enKeys);
  });
});

describe('Language Selection State Machine Flow', () => {
  it('starts at LANGUAGE_SELECT state', () => {
    expect(INITIAL_KIOSK_STATE.currentState).toBe(KIOSK_STATES.LANGUAGE_SELECT);
  });

  it('transitions to IDLE when language is selected', () => {
    const idleState = kioskReducer(INITIAL_KIOSK_STATE, { type: 'SELECT_LANGUAGE' });
    expect(idleState.currentState).toBe(KIOSK_STATES.IDLE);
  });

  it('can open LANGUAGE_SELECT mid-session via persistent switcher', () => {
    const washingState = {
      ...INITIAL_KIOSK_STATE,
      currentState: KIOSK_STATES.WASHING
    };
    const langSelectState = kioskReducer(washingState, { type: 'OPEN_LANGUAGE_SELECT' });
    expect(langSelectState.currentState).toBe(KIOSK_STATES.LANGUAGE_SELECT);
  });
});
