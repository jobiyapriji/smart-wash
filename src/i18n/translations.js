/**
 * SMART WASH — Internationalization Translations (Tailored for Kids)
 * Supported Languages: English (en), Malayalam (ml), Hindi (hi)
 * 
 * WHO Step standard titles are preserved for educational accuracy,
 * while spoken audio prompts and UI messages are energetic, warm, and playful for children!
 */

export const en = {
  // App & States
  kiosk_title: 'WASH STATION 🫧',
  state_label: 'Status:',
  exit_kiosk: '← Exit Station',
  change_language: 'Language',
  
  // State Names
  state_language_select: 'Language Select',
  state_idle: 'Ready to Wash!',
  state_identifying: 'Looking for Face...',
  state_ready: 'Ready to Wash',
  state_washing: 'Scrub Time!',
  state_scoring: 'Calculating Stars...',
  state_feedback: 'Superstar Score!',
  state_unknown_student: 'Unknown Person',
  state_multiple_faces: 'One Buddy at a Time',

  // Language Selection Screen
  select_language_title: 'Choose your language! 🗣️',
  select_language_subtitle: 'Tap a big button to start scrubbing!',
  auto_continue_countdown: 'Starting in {seconds}s with {lang}',
  lang_en: 'English',
  lang_ml: 'മലയാളം',
  lang_hi: 'हिन्दी',

  // IDLE State
  welcome_title: 'Welcome to SMART WASH! 🫧',
  welcome_subtitle: 'Step up to the sink and smile at the camera! We will wash away germs with fun scrub steps.',
  start_wash_now: '▶ Start Washing & Have Fun!',
  quick_select_student: 'Or tap your name below:',

  // IDENTIFYING State
  identity_confirmed: 'Woohoo! Welcome back!',
  welcome_back: 'Hello there, {name}! Ready to scrub?',
  starting_session: 'Getting the sink ready for you...',
  face_detecting_title: 'Looking at camera... Scanning!',
  looking_in_database: 'Finding your profile... Starting in 2 seconds!',
  start_immediately: 'Start Washing Right Now ➔',

  // MULTIPLE_FACES State
  multiple_faces_title: 'ONE LITTLE HERO AT A TIME! 👯',
  multiple_faces_desc: 'Please let only one person stand in front of the camera so we can see you clearly.',
  // UNKNOWN_STUDENT State
  unknown_person_title: 'Unknown person',
  unknown_person_body: 'Please ask your teacher to add you to the class.',
  unknown_person_audio: 'Unknown person. Please ask your teacher to add you to the class.',

  // WASHING State
  who_standard_banner: '🌟 WHO Superhero Handwash Steps',
  step_header: 'Step {step}: {name}',
  target_seconds: 'Goal: {seconds}s',
  active_movement: '🟢 Awesome Scrubbing! Scrub Timer Active!',
  movement_paused: '⚠️ Keep hands moving to scrub!',
  timer_active: 'Scrub Timer Active',
  timer_frozen: 'Timer Paused · Keep Scrubbing!',
  hands_still_prompt: 'Keep those hands up and scrub, scrub, scrub in view!',
  step_badge: 'STEP {step}',
  step_done: '✓ Done!',
  in_progress: 'SCRUBBING',
  touchless_active: 'Touchless AI Vision Active · Follow the Fun Guidance!',
  skip_step: 'Next Step ➔',
  complete_and_score: 'All Done! See Score ➔',
  live_demo: '▶ Watch Demonstration',

  // 6 WHO Steps
  step_1_name: 'Palm to Palm',
  step_1_instruction: 'Rub your palms together fast and make lots of bubbly foam! Round and round!',
  step_2_name: 'Palm over Dorsum',
  step_2_instruction: 'Scrub the back of each hand thoroughly, then swap sides!',
  step_3_name: 'Fingers Interlaced',
  step_3_instruction: 'Interlace your fingers like a friendly high-five puzzle and scrub in between!',
  step_4_name: 'Backs of Fingers',
  step_4_instruction: 'Lock your fingers together and give your knuckles a squeaky clean scrub!',
  step_5_name: 'Thumbs',
  step_5_instruction: 'Hold each thumb and twist round and round like a rocket!',
  step_6_name: 'Fingertips',
  step_6_instruction: 'Tickle your palm with your fingertips in circles to clean under the nails!',

  // FEEDBACK State
  score_out_of_100: 'Score / 100',
  great_job_name: 'Superstar Wash, {name}! 🎉',
  handwash_complete: 'Squeaky Clean Hands! 🎉',
  feedback_excellent: 'Superstar Washer! Sparkling Clean & Germ-Free!',
  feedback_good: 'Great Job Champ! Almost Perfect!',
  feedback_practice: 'Good Try Buddy! Keep Practicing to Beat Your Score!',
  steps_tracked: 'Steps Mastered',
  streak_bonus: 'Hygiene Bonus',
  reset_next_student: 'Ready for Next Buddy ({countdown}s)',

  // Camera Overlay
  ai_vision_engine: 'AI Kiosk Vision Engine',
  scanning_face: 'Scanning face... Looking good!',
  position_face: 'Position your face in the oval frame',
  rub_hands_in_view: 'Scrub Hands in View · Step {step}',
  student_id_label: 'Student ID',

  // Kid-Friendly Spoken Audio Scripts
  choose_language_prompt: 'Hi friend! Tap a big button to choose your language!',
  welcome_audio: "Welcome little hero! Step up to the sink and look right into the camera. Let's make some bubbly foam!",
  step_1_audio: 'Step 1: Rub your palms together fast and make lots of bubbly foam! Round and round!',
  step_2_audio: 'Step 2: Wash the back of your hands! Scrub over one hand, then swap and do the other!',
  step_3_audio: 'Step 3: Interlock your fingers like a friendly high-five puzzle! Scrub right in between!',
  step_4_audio: 'Step 4: Lock your fingers like a little cage and give your knuckles a squeaky clean scrub!',
  step_5_audio: "Step 5: Don't forget your thumbs! Hold each thumb and twist it round and round like a rocket!",
  step_6_audio: 'Step 6: Tickle your palms with your fingertips! Spin them in circles to clean under the nails!',
  step_complete_audio: "Woohoo! Step done, you're doing amazing! On to the next one!",
  keep_scrubbing_audio: 'Keep those hands moving, superhero! Scrub, scrub, scrub in front of the camera!',
  wash_finished_audio: 'Yay, all done! Great scrubbing while we check your awesome score!',
  encouragement_excellent_audio: 'Wow, 100% clean superstar! Your hands are sparkling clean and germ-free! High five!',
  encouragement_good_audio: 'Great scrubbing champ! You chased almost all the germs away. Keep up the awesome work!',
  encouragement_practice_audio: "Good try little buddy! Let's practice all 6 steps next time to become a handwashing master!"
};

export const ml = {
  // App & States
  kiosk_title: 'വാഷ് സ്റ്റേഷൻ 🫧',
  state_label: 'നില:',
  exit_kiosk: '← പുറത്തുകടക്കുക',
  change_language: 'ഭാഷ മാറ്റുക',
  
  // State Names
  state_language_select: 'ഭാഷ തിരഞ്ഞെടുക്കൽ',
  state_idle: 'കൈകഴുകാൻ തയ്യാറാണ്!',
  state_identifying: 'തിരിച്ചറിയുന്നു...',
  state_ready: 'കൈകഴുകാൻ തയ്യാറാണ്',
  state_washing: 'കൈകഴുകൽ സമയം!',
  state_scoring: 'നക്ഷത്രങ്ങൾ എണ്ണുന്നു...',
  state_feedback: 'സൂപ്പർ സ്കോർ!',
  state_unknown_student: 'പരിചയമില്ലാത്ത ആൾ',
  state_multiple_faces: 'ഒരാൾ മാത്രം വരിക',

  // Language Selection Screen
  select_language_title: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കൂ! 🗣️',
  select_language_subtitle: 'കൈകഴുകൽ ആരംഭിക്കാൻ വലിയ ബട്ടണിൽ തൊടൂ!',
  auto_continue_countdown: '{seconds} സെക്കൻഡിൽ {lang} ഭാഷയിൽ തുടങ്ങും',
  lang_en: 'English',
  lang_ml: 'മലയാളം',
  lang_hi: 'हिन्दी',

  // IDLE State
  welcome_title: 'സ്മാർട്ട് വാഷിലേക്ക് സ്വാഗതം കൂട്ടുകാരേ! 🫧',
  welcome_subtitle: 'സിങ്കിനടുത്തേക്ക് വന്ന് ക്യാമറയിലേക്ക് ചിരിക്കൂ! രസകരമായ ആറ് ഘട്ടങ്ങളിലൂടെ നമുക്ക് അണുക്കളെ തുരത്താം.',
  start_wash_now: '▶ കൈകഴുകി കളിക്കാം!',
  quick_select_student: 'അല്ലെങ്കിൽ പേര് തിരഞ്ഞെടുക്കുക:',

  // IDENTIFYING State
  identity_confirmed: 'തിരിച്ചറിഞ്ഞു കഴിഞ്ഞു! സ്വാഗതം!',
  welcome_back: 'നമസ്കാരം, {name}! കൈകൾ ഉരസി തുടങ്ങാമോ?',
  starting_session: 'കൈകഴുകാൻ സിങ്ക് തയ്യാറാക്കുന്നു...',
  face_detecting_title: 'ക്യാമറയിൽ നോക്കൂ... തിരിച്ചറിയുന്നു!',
  looking_in_database: 'വിവരങ്ങൾ നോക്കുന്നു... 2 സെക്കൻഡിൽ തുടങ്ങും!',
  start_immediately: 'ഉടൻ തന്നെ ആരംഭിക്കുക ➔',

  // MULTIPLE_FACES State
  multiple_faces_title: 'ഒരേ സമയം ഒരാൾ മാത്രം! 👯',
  multiple_faces_desc: 'ക്യാമറയിൽ വ്യക്തമായി കാണാൻ ഒരാൾ മാത്രം മുന്നിൽ നിൽക്കുക.',
  // UNKNOWN_STUDENT State
  unknown_person_title: 'പരിചയമില്ലാത്ത ആൾ',
  unknown_person_body: 'നിങ്ങളെ ക്ലാസ് ലിസ്റ്റിൽ ചേർക്കാൻ ടീച്ചറോട് പറയൂ.',
  unknown_person_audio: 'പരിചയമില്ലാത്ത ആൾ. നിങ്ങളെ ക്ലാസ് ലിസ്റ്റിൽ ചേർക്കാൻ ടീച്ചറോട് പറയൂ.',

  // WASHING State
  who_standard_banner: '🌟 സൂപ്പർ ഹീറോ കൈകഴുകൽ ഘട്ടങ്ങൾ',
  step_header: 'ഘട്ടം {step}: {name}',
  target_seconds: 'ലക്ഷ്യം: {seconds} സെ.',
  active_movement: '🟢 അടിപൊളി ഉരസൽ! സ്ക്രബ് ടൈമർ ഓടുന്നുണ്ട്!',
  movement_paused: '⚠️ കൈകൾ നിർത്തിവെക്കല്ലേ, ഉരസൂ!',
  timer_active: 'സ്ക്രബ് ടൈമർ ഓടുന്നുണ്ട്',
  timer_frozen: 'ടൈമർ നിന്നു · കൈകൾ ഉരസൂ!',
  hands_still_prompt: 'കൈകൾ ഉയർത്തിപ്പിടിച്ച് നന്നായി ഉരസിക്കൊണ്ടേയിരിക്കൂ!',
  step_badge: 'ഘട്ടം {step}',
  step_done: '✓ കഴിഞ്ഞു!',
  in_progress: 'ഉരസുന്നു',
  touchless_active: 'സ്പർശനരഹിത AI ക്യാമറ സജീവം · നിർദ്ദേശങ്ങൾ പാലിക്കുക',
  skip_step: 'അടുത്ത ഘട്ടം ➔',
  complete_and_score: 'കഴിഞ്ഞു! സ്കോർ കാണാം ➔',
  live_demo: '▶ വീഡിയോ കാണാം',

  // 6 WHO Steps (Official Reference Translations preserved for matching)
  step_1_name: 'ഉള്ളങ്കൈകൾ തമ്മിൽ ഉരസുക',
  step_1_instruction: 'ഉള്ളങ്കൈകൾ തമ്മിൽ വേഗത്തിൽ ഉരസൂ! സോപ്പ് കുമിളകൾ നിറയെ ഉണ്ടാക്കിക്കോളൂ!',
  step_2_name: 'വലത്തേ കൈപ്പത്തി ഇടത്തേ കൈയുടെ പുറത്ത് ഉരസുക, പിന്നെ മാറ്റി ചെയ്യുക',
  step_2_instruction: 'കൈയുടെ പുറകുവശം ഉരസൂ! ഒരു കൈ മാറ്റി മറ്റേ കൈയും നന്നായി തേച്ചുരയ്ക്കൂ!',
  step_3_name: 'വിരലുകൾ കോർത്തുപിടിച്ച് ഉള്ളങ്കൈകൾ ഉരസുക',
  step_3_instruction: 'വിരലുകൾ തമ്മിൽ കോർത്തുപിടിക്കൂ! വിരലുകൾക്കിടയിലെ അഴുക്കൊക്കെ കളയാൻ നന്നായി ഉരസൂ!',
  step_4_name: 'വിരലുകളുടെ പുറംഭാഗം മറ്റേ കൈപ്പത്തിയിൽ ഉരസുക',
  step_4_instruction: 'വിരലുകൾ പൂട്ടിപ്പിടിച്ച് കൈപ്പത്തിയിൽ ഉരസൂ! വിരലുകളുടെ പുറംഭാഗം തിളങ്ങട്ടെ!',
  step_5_name: 'തള്ളവിരൽ വട്ടത്തിൽ ഉരസുക',
  step_5_instruction: 'തള്ളവിരലുകൾ മറക്കല്ലേ! തള്ളവിരൽ കൈപ്പിടിയിലൊതുക്കി റോക്കറ്റ് പോലെ വട്ടത്തിൽ തിരിക്കൂ!',
  step_6_name: 'വിരൽത്തുമ്പുകൾ ഉള്ളങ്കൈയിൽ വട്ടത്തിൽ ഉരസുക',
  step_6_instruction: 'വിരൽത്തുമ്പുകൾ കൊണ്ട് കൈപ്പത്തിയിൽ ഇക്കിളിയിടൂ! നഖത്തിനടിയിലെ അഴുക്ക് മാറാൻ വട്ടത്തിൽ ഉരസൂ!',

  // FEEDBACK State
  score_out_of_100: 'സ്കോർ / 100',
  great_job_name: 'തകർത്തു കൂട്ടുകാരാ, {name}! 🎉',
  handwash_complete: 'കൈകൾ വൃത്തിയായി തിളങ്ങുന്നു! 🎉',
  feedback_excellent: 'സൂപ്പർ ഹീറോ! കൈകൾ കണ്ണാടി പോലെ തിളങ്ങുന്നു!',
  feedback_good: 'മിടുക്കൻ തന്നെ! ഒട്ടുമിക്ക അണുക്കളും ഓടിപ്പോയി!',
  feedback_practice: 'നല്ല ശ്രമം കൂട്ടുകാരാ! ഇനിയും പരിശീലിക്കാം!',
  steps_tracked: 'പൂർത്തിയാക്കിയ ഘട്ടങ്ങൾ',
  streak_bonus: 'ബോണസ് പോയിന്റുകൾ',
  reset_next_student: 'അടുത്ത കൂട്ടുകാരനായി ഒരുങ്ങുന്നു ({countdown} സെ.)',

  // Camera Overlay
  ai_vision_engine: 'AI വിഷൻ എൻജിൻ',
  scanning_face: 'മുഖം നോക്കുന്നു... സൂപ്പർ ചിരി!',
  position_face: 'മുഖം ഫ്രെയിമിനുള്ളിൽ വെക്കൂ',
  rub_hands_in_view: 'കൈകൾ ഉരസൂ · ഘട്ടം {step}',
  student_id_label: 'വിദ്യാർത്ഥി ഐഡി',

  // Kid-Friendly Spoken Audio Scripts
  choose_language_prompt: 'ഹലോ കൂട്ടുകാരേ! നിങ്ങൾക്ക് ഇഷ്ടമുള്ള ഭാഷ തിരഞ്ഞെടുക്കൂ!',
  welcome_audio: 'സ്മാർട്ട് വാഷിലേക്ക് സ്വാഗതം കൊച്ചു കൂട്ടുകാരാ! സിങ്കിനടുത്തേക്ക് വന്ന് ക്യാമറയിൽ നോക്കൂ, നമുക്ക് സോപ്പ് കുമിളകളുണ്ടാക്കി കളിക്കാം!',
  step_1_audio: 'ഒന്നാം ഘട്ടം: ഉള്ളങ്കൈകൾ തമ്മിൽ വേഗത്തിൽ ഉരസൂ! സോപ്പ് കുമിളകൾ നിറയെ ഉണ്ടാക്കിക്കോളൂ!',
  step_2_audio: 'രണ്ടാം ഘട്ടം: കൈയുടെ പുറകുവശം ഉരസൂ! ഒരു കൈ മാറ്റി മറ്റേ കൈയും നന്നായി തേച്ചുരയ്ക്കൂ!',
  step_3_audio: 'മൂന്നാം ഘട്ടം: വിരലുകൾ തമ്മിൽ കോർത്തുപിടിക്കൂ! വിരലുകൾക്കിടയിലെ അഴുക്കൊക്കെ കളയാൻ നന്നായി ഉരസൂ!',
  step_4_audio: 'നാലാം ഘട്ടം: വിരലുകൾ പൂട്ടിപ്പിടിച്ച് കൈപ്പത്തിയിൽ ഉരസൂ! വിരലുകളുടെ പുറംഭാഗം തിളങ്ങട്ടെ!',
  step_5_audio: 'അഞ്ചാം ഘട്ടം: തള്ളവിരലുകൾ മറക്കല്ലേ! തള്ളവിരൽ കൈപ്പിടിയിലൊതുക്കി റോക്കറ്റ് പോലെ വട്ടത്തിൽ തിരിക്കൂ!',
  step_6_audio: 'ആറാം ഘട്ടം: വിരൽത്തുമ്പുകൾ കൊണ്ട് കൈപ്പത്തിയിൽ ഇക്കിളിയിടൂ! നഖത്തിനടിയിലെ അഴുക്ക് മാറാൻ വട്ടത്തിൽ ഉരസൂ!',
  step_complete_audio: 'അടിപൊളി! ആ ഘട്ടം കഴിഞ്ഞു, നീ കേമനാണ്! ഇനി അടുത്തതിലേക്ക്!',
  keep_scrubbing_audio: 'കൈകൾ നിർത്തല്ലേ കൂട്ടുകാരാ! ക്യാമറയ്ക്ക് മുന്നിൽ കൈകൾ വേഗത്തിൽ ഉരസിക്കൊണ്ടേയിരിക്കൂ!',
  wash_finished_audio: 'യേയ്! കൈകഴുകൽ കഴിഞ്ഞു! നീ എത്ര മിടുക്കനാണെന്ന് നമുക്ക് സ്കോർ ബോർഡിൽ നോക്കാം!',
  encouragement_excellent_audio: 'വാവ്! നീ സൂപ്പർ ഹീറോ തന്നെ! കൈകൾ കണ്ണാടി പോലെ തിളങ്ങുന്നു, ഒരു തകർപ്പൻ ഹൈ-ഫൈവ്!',
  encouragement_good_audio: 'മിടുക്കൻ തന്നെ! ഒട്ടുമിക്ക അണുക്കളെയും നീ ഓടിച്ചുവിട്ടു! ഇനിയും ഇതുപോലെ മിടുക്കനാവണം!',
  encouragement_practice_audio: 'നല്ല ശ്രമം കൂട്ടുകാരാ! അടുത്ത തവണ ആറ് ഘട്ടങ്ങളും പൂർത്തിയാക്കി നമുക്ക് ഒന്നാമനാവാം!'
};

export const hi = {
  // App & States
  kiosk_title: 'वॉश स्टेशन 🫧',
  state_label: 'स्थिति:',
  exit_kiosk: '← बाहर निकलें',
  change_language: 'भाषा बदलें',
  
  // State Names
  state_language_select: 'भाषा चयन',
  state_idle: 'हाथ धोने के लिए तैयार!',
  state_identifying: 'चेहरा खोज रहे हैं...',
  state_ready: 'हाथ धोने के लिए तैयार',
  state_washing: 'हाथ रगड़ने का समय!',
  state_scoring: 'तारे गिन रहे हैं...',
  state_feedback: 'सुपरस्टार स्कोर!',
  state_unknown_student: 'अज्ञात व्यक्ति',
  state_multiple_faces: 'एक बार में एक दोस्त',

  // Language Selection Screen
  select_language_title: 'अपनी भाषा चुनें! 🗣️',
  select_language_subtitle: 'हाथ धोना शुरू करने के लिए बड़े बटन पर छुएं!',
  auto_continue_countdown: '{seconds} सेकंड में {lang} में शुरू होगा',
  lang_en: 'English',
  lang_ml: 'മലയാളം',
  lang_hi: 'हिन्दी',

  // IDLE State
  welcome_title: 'स्मार्ट वॉश में आपका स्वागत है दोस्त! 🫧',
  welcome_subtitle: 'सिंक के पास आओ और कैमरे में मुस्कुराओ! चलो मज़ेदार चरणों से सारे कीटाणुओं को भगाएं।',
  start_wash_now: '▶ चलो हाथ धोएं और मज़ा करें!',
  quick_select_student: 'या नीचे अपना नाम चुनें:',

  // IDENTIFYING State
  identity_confirmed: 'पहचान की पुष्टि हुई! शाबाश!',
  welcome_back: 'नमस्ते {name}! हाथ रगड़ने के लिए तैयार हो?',
  starting_session: 'आपके लिए सिंक तैयार किया जा रहा है...',
  face_detecting_title: 'कैमरे में देखो... पहचान हो रही है!',
  looking_in_database: 'प्रोफाइल खोज रहे हैं... बस 2 सेकंड में शुरू!',
  start_immediately: 'तुरंत शुरू करें ➔',

  // MULTIPLE_FACES State
  multiple_faces_title: 'एक समय में केवल एक सुपरहीरो! 👯',
  multiple_faces_desc: 'कृपया कैमरे के सामने एक ही बच्चा खड़ा हो ताकि हम आपको साफ़ देख सकें।',
  // UNKNOWN_STUDENT State
  unknown_person_title: 'अज्ञात व्यक्ति',
  unknown_person_body: 'कृपया अपने शिक्षक से कक्षा में नाम जोड़ने को कहें।',
  unknown_person_audio: 'अज्ञात व्यक्ति. कृपया अपने शिक्षक से कक्षा में नाम जोड़ने को कहें।',

  // WASHING State
  who_standard_banner: '🌟 सुपरहीरो हाथ धोने के चरण',
  step_header: 'चरण {step}: {name}',
  target_seconds: 'लक्ष्य: {seconds} से.',
  active_movement: '🟢 बहुत बढ़िया रगड़ रहे हो! स्क्रब टाइमर सक्रिय है!',
  movement_paused: '⚠️ हाथ मत रोको, रगड़ते रहो!',
  timer_active: 'स्क्रब टाइमर सक्रिय है',
  timer_frozen: 'टाइमर रुका · रगड़ते रहो!',
  hands_still_prompt: 'हाथ ऊपर रखो और छप-छप रगड़ते रहो!',
  step_badge: 'चरण {step}',
  step_done: '✓ पूरा हुआ!',
  in_progress: 'रगड़ रहे हैं',
  touchless_active: 'टचलेस एआई विज़न सक्रिय · निर्देशों का पालन करें',
  skip_step: 'अगला चरण ➔',
  complete_and_score: 'पूरा हुआ! स्कोर देखें ➔',
  live_demo: '▶ वीडियो देखें',

  // 6 WHO Steps (Official Reference Translations preserved for matching)
  step_1_name: 'हथेली से हथेली रगड़ें',
  step_1_instruction: 'दोनों हथेलियों को आपस में खूब रगड़ो! गोल-गोल घुमाओ और ढेर सारे बुलबुले बनाओ!',
  step_2_name: 'दाएँ हाथ की हथेली से बाएँ हाथ का पिछला हिस्सा रगड़ें, फिर बदलें',
  step_2_instruction: 'अब हाथों के पिछले हिस्से को चमकाओ! एक हाथ से दूसरे हाथ के ऊपर रगड़ो, फिर बदलकर करो!',
  step_3_name: 'उँगलियाँ आपस में फँसाकर हथेलियाँ रगड़ें',
  step_3_instruction: 'उँगलियों को आपस में फँसाओ, जैसे ताली बजा रहे हों! उँगलियों के बीच से सारी धूल भगाओ!',
  step_4_name: 'उँगलियों के पिछले हिस्से को दूसरी हथेली पर रगड़ें',
  step_4_instruction: 'उँगलियों को मुट्ठी की तरह जोड़ो और दूसरी हथेली पर रगड़ो! पोरों को बिल्कुल साफ़ कर लो!',
  step_5_name: 'अंगूठे को गोल घुमाकर रगड़ें',
  step_5_instruction: 'अंगूठे को मत भूलना! अंगूठे को मुट्ठी में पकड़ो और रॉकेट की तरह गोल-गोल घुमाओ!',
  step_6_name: 'उँगलियों के सिरे हथेली में घुमाकर रगड़ें',
  step_6_instruction: 'उँगलियों के पोरों से हथेली में गुदगुदी करो! गोल-गोल घुमाकर नाखूनों की सफाई करो!',

  // FEEDBACK State
  score_out_of_100: 'स्कोर / 100',
  great_job_name: 'कमाल कर दिया, {name}! 🎉',
  handwash_complete: 'मोतियों जैसे साफ़ हाथ! 🎉',
  feedback_excellent: 'सुपरस्टार! आपके हाथ मोतियों जैसे चमक रहे हैं!',
  feedback_good: 'शाबाश चैंपियन! सारे कीटाणु डरकर भाग गए!',
  feedback_practice: 'अच्छी कोशिश दोस्त! अगली बार पूरे सौ नंबर लाएंगे!',
  steps_tracked: 'पूरे किए गए चरण',
  streak_bonus: 'सफाई बोनस',
  reset_next_student: 'अगले दोस्त के लिए तैयार ({countdown} से.)',

  // Camera Overlay
  ai_vision_engine: 'एआई विज़न इंजन',
  scanning_face: 'चेहरा देख रहे हैं... बहुत प्यारी मुस्कान!',
  position_face: 'चेहरे को फ्रेम में रखें',
  rub_hands_in_view: 'हाथ रगड़ें · चरण {step}',
  student_id_label: 'छात्र आईडी',

  // Kid-Friendly Spoken Audio Scripts
  choose_language_prompt: 'नमस्ते दोस्त! अपनी मनपसंद भाषा चुनने के लिए बटन दबाओ!',
  welcome_audio: 'स्मार्ट वॉश में स्वागत है नन्हे दोस्त! सिंक के पास आओ और कैमरे में मुस्कुराओ, चलो खूब सारे झाग बनाते हैं!',
  step_1_audio: 'पहला कदम: दोनों हथेलियों को आपस में खूब रगड़ो! गोल-गोल घुमाओ और ढेर सारे बुलबुले बनाओ!',
  step_2_audio: 'दूसरा कदम: अब हाथों के पिछले हिस्से को चमकाओ! एक हाथ से दूसरे हाथ के ऊपर रगड़ो, फिर बदलकर करो!',
  step_3_audio: 'तीसरा कदम: उँगलियों को आपस में फँसाओ, जैसे ताली बजा रहे हों! उँगलियों के बीच से सारी धूल भगाओ!',
  step_4_audio: 'चौथा कदम: उँगलियों को मुट्ठी की तरह जोड़ो और दूसरी हथेली पर रगड़ो! पोरों को बिल्कुल साफ़ कर लो!',
  step_5_audio: 'पाँचवाँ कदम: अंगूठे को मत भूलना! अंगूठे को मुट्ठी में पकड़ो और रॉकेट की तरह गोल-गोल घुमाओ!',
  step_6_audio: 'छठा कदम: उँगलियों के पोरों से हथेली में गुदगुदी करो! गोल-गोल घुमाकर नाखूनों की सफाई करो!',
  step_complete_audio: 'वाह भाई वाह! यह चरण पूरा हुआ, तुम बहुत बढ़िया कर रहे हो! अब अगला चरण!',
  keep_scrubbing_audio: 'हाथ मत रोको नन्हे सुपरहीरो! कैमरे के सामने हाथों को रगड़ते रहो, छप-छप-छप!',
  wash_finished_audio: 'अरे वाह, हाथ धुल गए! चलो देखते हैं हमारे नन्हे चैंपियन को कितने अंक मिले!',
  encouragement_excellent_audio: 'अरे वाह! तुम तो असली सुपरहीरो निकले! हाथ बिल्कुल मोतियों जैसे चमक रहे हैं, लाओ ताली दो!',
  encouragement_good_audio: 'बहुत अच्छा धोया चैंपियन! सारे कीटाणु डरकर भाग गए। ऐसे ही रोज़ हाथ धोना!',
  encouragement_practice_audio: 'शाबाश छोटे दोस्त! अगली बार सभी छह कदम करके पूरे सौ नंबर लाएंगे!'
};

export const translations = { en, ml, hi };
export default translations;
