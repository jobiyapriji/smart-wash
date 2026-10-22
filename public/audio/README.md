# 🧼 SMART WASH — Audio Voice Scripts (Tailored for Kids)

This directory contains pre-recorded MP3 voice prompts for the SMART WASH Kiosk.
The scripts are specially written for young children (Kindergarten & Primary School): energetic, encouraging, and playful, using cheerful sound metaphors like bubble-making, friendly high-fives, and superhero germ-busting.

## Directory Structure

```
public/
  audio/
    en/    (English voice files)
    ml/    (Malayalam voice files)
    hi/    (Hindi voice files)
    README.md
```

## How Audio Works
1. When a child reaches a step or screen, the kiosk **checks for the pre-recorded `.mp3` file** at `/audio/{lang}/{key}.mp3`.
2. If recorded, it plays the clear, friendly voice actor audio.
3. If the `.mp3` file has not been recorded yet, the system smoothly falls back to browser **Web Speech Synthesis** (`window.speechSynthesis`), reading the kid-friendly script.
4. When a child taps a new step or changes language, previous audio stops immediately so voices never overlap.

---

## 🎙️ Complete Kid-Friendly Voice Scripts for Recording

Record each file with an upbeat, warm, smiling teacher/animator tone at a moderate, clear pace.

---

### 1. Language Selection & Welcome

#### 📁 `choose_language_prompt.mp3`
- 🇬🇧 **English (`en/`)**: *"Hi friend! Tap a big button to choose your language!"*
- 🌴 **Malayalam (`ml/`)**: *"ഹലോ കൂട്ടുകാരേ! നിങ്ങൾക്ക് ഇഷ്ടമുള്ള ഭാഷ തിരഞ്ഞെടുക്കൂ!"*
- 🪷 **Hindi (`hi/`)**: *"नमस्ते दोस्त! अपनी मनपसंद भाषा चुनने के लिए बटन दबाओ!"*

#### 📁 `welcome_audio.mp3`
- 🇬🇧 **English (`en/`)**: *"Welcome little hero! Step up to the sink and look right into the camera. Let's make some bubbly foam!"*
- 🌴 **Malayalam (`ml/`)**: *"സ്മാർട്ട് വാഷിലേക്ക് സ്വാഗതം കൊച്ചു കൂട്ടുകാരാ! സിങ്കിനടുത്തേക്ക് വന്ന് ക്യാമറയിൽ നോക്കൂ, നമുക്ക് സോപ്പ് കുമിളകളുണ്ടാക്കി കളിക്കാം!"*
- 🪷 **Hindi (`hi/`)**: *"स्मार्ट वॉश में स्वागत है नन्हे दोस्त! सिंक के पास आओ और कैमरे में मुस्कुराओ, चलो खूब सारे झाग बनाते हैं!"*

---

### 2. The 6 WHO Handwashing Steps

#### 📁 `step_1_audio.mp3` — Palm to Palm
- 🇬🇧 **English (`en/`)**: *"Step 1: Rub your palms together fast and make lots of bubbly foam! Round and round!"*
- 🌴 **Malayalam (`ml/`)**: *"ഒന്നാം ഘട്ടം: ഉള്ളങ്കൈകൾ തമ്മിൽ വേഗത്തിൽ ഉരസൂ! സോപ്പ് കുമിളകൾ നിറയെ ഉണ്ടാക്കിക്കോളൂ!"*
- 🪷 **Hindi (`hi/`)**: *"पहला कदम: दोनों हथेलियों को आपस में खूब रगड़ो! गोल-गोल घुमाओ और ढेर सारे बुलबुले बनाओ!"*

#### 📁 `step_2_audio.mp3` — Palm over Back of Hand
- 🇬🇧 **English (`en/`)**: *"Step 2: Wash the back of your hands! Scrub over one hand, then swap and do the other!"*
- 🌴 **Malayalam (`ml/`)**: *"രണ്ടാം ഘട്ടം: കൈയുടെ പുറകുവശം ഉരസൂ! ഒരു കൈ മാറ്റി മറ്റേ കൈയും നന്നായി തേച്ചുരയ്ക്കൂ!"*
- 🪷 **Hindi (`hi/`)**: *"दूसरा कदम: अब हाथों के पिछले हिस्से को चमकाओ! एक हाथ से दूसरे हाथ के ऊपर रगड़ो, फिर बदलकर करो!"*

#### 📁 `step_3_audio.mp3` — Fingers Interlaced
- 🇬🇧 **English (`en/`)**: *"Step 3: Interlock your fingers like a friendly high-five puzzle! Scrub right in between!"*
- 🌴 **Malayalam (`ml/`)**: *"മൂന്നാം ഘട്ടം: വിരലുകൾ തമ്മിൽ കോർത്തുപിടിക്കൂ! വിരലുകൾക്കിടയിലെ അഴുക്കൊക്കെ കളയാൻ നന്നായി ഉരസൂ!"*
- 🪷 **Hindi (`hi/`)**: *"तीसरा कदम: उँगलियों को आपस में फँसाओ, जैसे ताली बजा रहे हों! उँगलियों के बीच से सारी धूल भगाओ!"*

#### 📁 `step_4_audio.mp3` — Backs of Fingers
- 🇬🇧 **English (`en/`)**: *"Step 4: Lock your fingers like a little cage and give your knuckles a squeaky clean scrub!"*
- 🌴 **Malayalam (`ml/`)**: *"നാലാം ഘട്ടം: വിരലുകൾ പൂട്ടിപ്പിടിച്ച് കൈപ്പത്തിയിൽ ഉരസൂ! വിരലുകളുടെ പുറംഭാഗം തിളങ്ങട്ടെ!"*
- 🪷 **Hindi (`hi/`)**: *"चौथा कदम: उँगलियों को मुट्ठी की तरह जोड़ो और दूसरी हथेली पर रगड़ो! पोरों को बिल्कुल साफ़ कर लो!"*

#### 📁 `step_5_audio.mp3` — Thumbs
- 🇬🇧 **English (`en/`)**: *"Step 5: Don't forget your thumbs! Hold each thumb and twist it round and round like a rocket!"*
- 🌴 **Malayalam (`ml/`)**: *"അഞ്ചാം ഘട്ടം: തള്ളവിരലുകൾ മറക്കല്ലേ! തള്ളവിരൽ കൈപ്പിടിയിലൊതുക്കി റോക്കറ്റ് പോലെ വട്ടത്തിൽ തിരിക്കൂ!"*
- 🪷 **Hindi (`hi/`)**: *"पाँचवाँ कदम: अंगूठे को मत भूलना! अंगूठे को मुट्ठी में पकड़ो और रॉकेट की तरह गोल-गोल घुमाओ!"*

#### 📁 `step_6_audio.mp3` — Fingertips on Palms
- 🇬🇧 **English (`en/`)**: *"Step 6: Tickle your palms with your fingertips! Spin them in circles to clean under the nails!"*
- 🌴 **Malayalam (`ml/`)**: *"ആറാം ഘട്ടം: വിരൽത്തുമ്പുകൾ കൊണ്ട് കൈപ്പത്തിയിൽ ഇക്കിളിയിടൂ! നഖത്തിനടിയിലെ അഴുക്ക് മാറാൻ വട്ടത്തിൽ ഉരസൂ!"*
- 🪷 **Hindi (`hi/`)**: *"छठा कदम: उँगलियों के पोरों से हथेली में गुदगुदी करो! गोल-गोल घुमाकर नाखूनों की सफाई करो!"*

---

### 3. Real-Time Encouragement & Reminders

#### 📁 `step_complete_audio.mp3`
- 🇬🇧 **English (`en/`)**: *"Woohoo! Step done, you're doing amazing! On to the next one!"*
- 🌴 **Malayalam (`ml/`)**: *"അടിപൊളി! ആ ഘട്ടം കഴിഞ്ഞു, നീ കേമനാണ്! ഇനി അടുത്തതിലേക്ക്!"*
- 🪷 **Hindi (`hi/`)**: *"वाह भाई वाह! यह चरण पूरा हुआ, तुम बहुत बढ़िया कर रहे हो! अब अगला चरण!"*

#### 📁 `keep_scrubbing_audio.mp3`
- 🇬🇧 **English (`en/`)**: *"Keep those hands moving, superhero! Scrub, scrub, scrub in front of the camera!"*
- 🌴 **Malayalam (`ml/`)**: *"കൈകൾ നിർത്തല്ലേ കൂട്ടുകാരാ! ക്യാമറയ്ക്ക് മുന്നിൽ കൈകൾ വേഗത്തിൽ ഉരസിക്കൊണ്ടേയിരിക്കൂ!"*
- 🪷 **Hindi (`hi/`)**: *"हाथ मत रोको नन्हे सुपरहीरो! कैमरे के सामने हाथों को रगड़ते रहो, छप-छप-छप!"*

#### 📁 `wash_finished_audio.mp3`
- 🇬🇧 **English (`en/`)**: *"Yay, all done! Shake off the bubbles while we check your awesome score!"*
- 🌴 **Malayalam (`ml/`)**: *"യേയ്! കൈകഴുകൽ കഴിഞ്ഞു! നീ എത്ര മിടുക്കനാണെന്ന് നമുക്ക് സ്കോർ ബോർഡിൽ നോക്കാം!"*
- 🪷 **Hindi (`hi/`)**: *"अरे वाह, हाथ धुल गए! चलो देखते हैं हमारे नन्हे चैंपियन को कितने अंक मिले!"*

---

### 4. Final Score & Positive Reinforcement

#### 📁 `encouragement_excellent_audio.mp3` (Score 85–100)
- 🇬🇧 **English (`en/`)**: *"Wow, 100% clean superstar! Your hands are sparkling clean and germ-free! High five!"*
- 🌴 **Malayalam (`ml/`)**: *"വാവ്! നീ സൂപ്പർ ഹീറോ തന്നെ! കൈകൾ കണ്ണാടി പോലെ തിളങ്ങുന്നു, ഒരു തകർപ്പൻ ഹൈ-ഫൈവ്!"*
- 🪷 **Hindi (`hi/`)**: *"अरे वाह! तुम तो असली सुपरहीरो निकले! हाथ बिल्कुल मोतियों जैसे चमक रहे हैं, लाओ ताली दो!"*

#### 📁 `encouragement_good_audio.mp3` (Score 70–84)
- 🇬🇧 **English (`en/`)**: *"Great scrubbing champ! You chased almost all the germs away. Keep up the awesome work!"*
- 🌴 **Malayalam (`ml/`)**: *"മിടുക്കൻ തന്നെ! ഒട്ടുമിക്ക അണുക്കളെയും നീ ഓടിച്ചുവിട്ടു! ഇനിയും ഇതുപോലെ മിടുക്കനാവണം!"*
- 🪷 **Hindi (`hi/`)**: *"बहुत अच्छा धोया चैंपियन! सारे कीटाणु डरकर भाग गए। ऐसे ही रोज़ हाथ धोना!"*

#### 📁 `encouragement_practice_audio.mp3` (Score <70)
- 🇬🇧 **English (`en/`)**: *"Good try little buddy! Let's practice all 6 steps next time to become a handwashing master!"*
- 🌴 **Malayalam (`ml/`)**: *"നല്ല ശ്രമം കൂട്ടുകാരാ! അടുത്ത തവണ ആറ് ഘട്ടങ്ങളും പൂർത്തിയാക്കി നമുക്ക് ഒന്നാമനാവാം!"*
- 🪷 **Hindi (`hi/`)**: *"शाबाश छोटे दोस्त! अगली बार सभी छह कदम करके पूरे सौ नंबर लाएंगे!"*

---

## 🎧 Recording Specifications
- **Format**: MP3 (`.mp3`)
- **Bitrate**: 128 kbps or 192 kbps
- **Sample Rate**: 44.1 kHz
- **Voice Style**: Friendly, cheerful, enthusiastic, children's narrator/teacher tone
