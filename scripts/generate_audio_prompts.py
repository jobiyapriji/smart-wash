import os
import sys
import asyncio
import edge_tts

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_AUDIO = os.path.join(BASE_DIR, "public", "audio")

VOICES = {
    "ml": "ml-IN-SobhanaNeural",
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural"
}

PROMPTS = {
    "ml": {
        "choose_language_prompt": "ഹലോ കൂട്ടുകാരേ! നിങ്ങൾക്ക് ഇഷ്ടമുള്ള ഭാഷ തിരഞ്ഞെടുക്കൂ!",
        "welcome_audio": "സ്മാർട്ട് വാഷിലേക്ക് സ്വാഗതം കൊച്ചു കൂട്ടുകാരാ! സിങ്കിനടുത്തേക്ക് വന്ന് ക്യാമറയിൽ നോക്കൂ, നമുക്ക് സോപ്പ് കുമിളകളുണ്ടാക്കി കളിക്കാം!",
        "step_1_audio": "ഒന്നാം ഘട്ടം: ഉള്ളങ്കൈകൾ തമ്മിൽ വേഗത്തിൽ ഉരസൂ! സോപ്പ് കുമിളകൾ നിറയെ ഉണ്ടാക്കിക്കോളൂ!",
        "step_2_audio": "രണ്ടാം ഘട്ടം: കൈയുടെ പുറകുവശം ഉരസൂ! ഒരു കൈ മാറ്റി മറ്റേ കൈയും നന്നായി തേച്ചുരയ്ക്കൂ!",
        "step_3_audio": "മൂന്നാം ഘട്ടം: വിരലുകൾ തമ്മിൽ കോർത്തുപിടിക്കൂ! വിരലുകൾക്കിടയിലെ അഴുക്കൊക്കെ കളയാൻ നന്നായി ഉരസൂ!",
        "step_4_audio": "നാലാം ഘട്ടം: വിരലുകൾ പൂട്ടിപ്പിടിച്ച് കൈപ്പത്തിയിൽ ഉരസൂ! വിരലുകളുടെ പുറംഭാഗം തിളങ്ങട്ടെ!",
        "step_5_audio": "അഞ്ചാം ഘട്ടം: തള്ളവിരലുകൾ മറക്കല്ലേ! തള്ളവിരൽ കൈപ്പിടിയിലൊതുക്കി റോക്കറ്റ് പോലെ വട്ടത്തിൽ തിരിക്കൂ!",
        "step_6_audio": "ആറാം ഘട്ടം: വിരൽത്തുമ്പുകൾ കൊണ്ട് കൈപ്പത്തിയിൽ ഇക്കിളിയിടൂ! നഖത്തിനടിയിലെ അഴുക്ക് മാറാൻ വട്ടത്തിൽ ഉരസൂ!",
        "step_complete_audio": "അടിപൊളി! ആ ഘട്ടം കഴിഞ്ഞു, നീ കേമനാണ്! ഇനി അടുത്തതിലേക്ക്!",
        "keep_scrubbing_audio": "കൈകൾ നിർത്തല്ലേ കൂട്ടുകാരാ! ക്യാമറയ്ക്ക് മുന്നിൽ കൈകൾ വേഗത്തിൽ ഉരസിക്കൊണ്ടേയിരിക്കൂ!",
        "wash_finished_audio": "യേയ്! കൈകഴുകൽ കഴിഞ്ഞു! നീ എത്ര മിടുക്കനാണെന്ന് നമുക്ക് സ്കോർ ബോർഡിൽ നോക്കാം!",
        "encouragement_excellent_audio": "വാവ്! നീ സൂപ്പർ ഹീറോ തന്നെ! കൈകൾ കണ്ണാടി പോലെ തിളങ്ങുന്നു, ഒരു തകർപ്പൻ ഹൈ-ഫൈവ്!",
        "encouragement_good_audio": "മിടുക്കൻ തന്നെ! ഒട്ടുമിക്ക അണുക്കളെയും നീ ഓടിച്ചുവിട്ടു! ഇനിയും ഇതുപോലെ മിടുക്കനാവണം!",
        "encouragement_practice_audio": "നല്ല ശ്രമം കൂട്ടുകാരാ! അടുത്ത തവണ ആറ് ഘട്ടങ്ങളും പൂർത്തിയാക്കി നമുക്ക് ഒന്നാമനാവാം!",
        "unknown_person_audio": "പരിചയമില്ലാത്ത ആൾ. നിങ്ങളെ ക്ലാസ് ലിസ്റ്റിൽ ചേർക്കാൻ ടീച്ചറോട് പറയൂ."
    },
    "en": {
        "choose_language_prompt": "Hi friend! Tap a big button to choose your language!",
        "welcome_audio": "Welcome little hero! Step up to the sink and look right into the camera. Let's make some bubbly foam!",
        "step_1_audio": "Step 1: Rub your palms together fast and make lots of bubbly foam! Round and round!",
        "step_2_audio": "Step 2: Wash the back of your hands! Scrub over one hand, then swap and do the other!",
        "step_3_audio": "Step 3: Interlock your fingers like a friendly high-five puzzle! Scrub right in between!",
        "step_4_audio": "Step 4: Lock your fingers like a little cage and give your knuckles a squeaky clean scrub!",
        "step_5_audio": "Step 5: Don't forget your thumbs! Hold each thumb and twist it round and round like a rocket!",
        "step_6_audio": "Step 6: Tickle your palms with your fingertips! Spin them in circles to clean under the nails!",
        "step_complete_audio": "Woohoo! Step done, you're doing amazing! On to the next one!",
        "keep_scrubbing_audio": "Keep those hands moving, superhero! Scrub, scrub, scrub in front of the camera!",
        "wash_finished_audio": "Yay, all done! Great scrubbing while we check your awesome score!",
        "encouragement_excellent_audio": "Wow, 100% clean superstar! Your hands are sparkling clean and germ-free! High five!",
        "encouragement_good_audio": "Great scrubbing champ! You chased almost all the germs away. Keep up the awesome work!",
        "encouragement_practice_audio": "Good try little buddy! Let's practice all 6 steps next time to become a handwashing master!",
        "unknown_person_audio": "Unknown person. Please ask your teacher to add you to the class."
    },
    "hi": {
        "choose_language_prompt": "नमस्ते दोस्त! अपनी मनपसंद भाषा चुनने के लिए बटन दबाओ!",
        "welcome_audio": "स्मार्ट वॉश में स्वागत है नन्हे दोस्त! सिंक के पास आओ और कैमरे में मुस्कुराओ, चलो खूब सारे झाग बनाते हैं!",
        "step_1_audio": "पहला कदम: दोनों हथेलियों को आपस में खूब रगड़ो! गोल-गोल घुमाओ और ढेर सारे बुलबुले बनाओ!",
        "step_2_audio": "दूसरा कदम: अब हाथों के पिछले हिस्से को चमकाओ! एक हाथ से दूसरे हाथ के ऊपर रगड़ो, फिर बदलकर करो!",
        "step_3_audio": "तीसरा कदम: उँगलियों को आपस में फँसाओ, जैसे ताली बजा रहे हों! उँगलियों के बीच से सारी धूल भगाओ!",
        "step_4_audio": "चौथा कदम: उँगलियों को मुट्ठी की तरह जोड़ो और दूसरी हथेली पर रगड़ो! पोरों को बिल्कुल साफ़ कर लो!",
        "step_5_audio": "पाँचवाँ कदम: अंगूठे को मत भूलना! अंगूठे को मुट्ठी में पकड़ो और रॉकेट की तरह गोल-गोल घुमाओ!",
        "step_6_audio": "छठा कदम: उँगलियों के पोरों से हथेली में गुदगुदी करो! गोल-गोल घुमाकर नाखूनों की सफाई करो!",
        "step_complete_audio": "वाह भाई वाह! यह चरण पूरा हुआ, तुम बहुत बढ़िया कर रहे हो! अब अगला चरण!",
        "keep_scrubbing_audio": "हाथ मत रोको नन्हे सुपरहीरो! कैमरे के सामने हाथों को रगड़ते रहो, छप-छप-छप!",
        "wash_finished_audio": "अरे वाह, हाथ धुल गए! चलो देखते हैं हमारे नन्हे चैंपियन को कितने अंक मिले!",
        "encouragement_excellent_audio": "अरे वाह! तुम तो असली सुपरहीरो निकले! हाथ बिल्कुल मोतियों जैसे चमक रहे हैं, लाओ ताली दो!",
        "encouragement_good_audio": "बहुत अच्छा धोया चैंपियन! सारे कीटाणु डरकर भाग गए। ऐसे ही रोज़ हाथ धोना!",
        "encouragement_practice_audio": "शाबाश छोटे दोस्त! अगली बार सभी छह कदम करके पूरे सौ नंबर लाएंगे!",
        "unknown_person_audio": "अज्ञात व्यक्ति. कृपया अपने शिक्षक से कक्षा में नाम जोड़ने को कहें।"
    }
}

async def generate_single(text, voice, out_file):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(out_file)

async def generate_all():
    for lang, items in PROMPTS.items():
        lang_dir = os.path.join(PUBLIC_AUDIO, lang)
        os.makedirs(lang_dir, exist_ok=True)
        voice = VOICES[lang]
        print(f"\n[GENERATING] Language: {lang} with voice '{voice}' ({len(items)} prompts)...")
        
        for key, text in items.items():
            out_file = os.path.join(lang_dir, f"{key}.mp3")
            if os.path.exists(out_file) and os.path.getsize(out_file) > 2000:
                print(f"  [OK] {key}.mp3 exists ({os.path.getsize(out_file)} bytes)")
                continue
            try:
                await generate_single(text, voice, out_file)
                size = os.path.getsize(out_file)
                print(f"  [+] Generated {key}.mp3 ({size} bytes)")
            except Exception as e:
                print(f"  [ERR] Failed {key}.mp3: {e}")

if __name__ == "__main__":
    asyncio.run(generate_all())
