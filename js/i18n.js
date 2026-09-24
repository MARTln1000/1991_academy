/* ============================================
   1991 Academy — i18n (English / Հայերեն)
   English strings ARE the keys: t("Mark as
   complete") returns Armenian in hy mode and
   the key itself in en mode — untranslated
   corners degrade gracefully to English.
   Content uses L(obj, "field") → obj.field_hy
   when present, else obj.field.
   ============================================ */

const I18N = (() => {
  const KEY = "martinium:lang";
  let lang = localStorage.getItem(KEY) === "hy" ? "hy" : "en";

  /* ---------- UI dictionary: English key → Armenian ---------- */
  const HY = {
    /* nav */
    "Lab": "Լաբ",
    "Missions": "Առաքելություններ",
    "Practice": "Կրկնություն",
    "Sign in": "Մուտք",
    "← All tracks": "← Բոլոր ուղիները",
    /* streak / pills */
    "{0}-day streak": "{0} օր անընդմեջ",
    "Start your streak": "Սկսի՛ր շարքդ",
    /* landing static */
    "hero.kicker": "⚡ Քո անձնական ուսումնական տիեզերքը",
    "hero.title": 'Սովորի՛ր խորությամբ։<br /><span class="grad">Վայելի՛ր ընթացքը։</span>',
    "hero.sub": "Յոթ կառուցված ուղի — մաթեմատիկա, ծրագրավորում, վեբ, մեքենայական ուսուցում, խորը ուսուցում, ԱԲ գործակալներ և ալգորիթմներ — գումարած Լաբը, որտեղ մոդելներ ու ալգորիթմներ ես գրում JavaScript-ով, Python-ով կամ C++-ով և տեսնում դրանք աշխատելիս։ Դասեր, տեսադասախոսություններ, հարցաշարեր, իրական կոդ։ Ոչ մի ավելորդ բան։",
    "tracks.title": "Ընտրի՛ր քո ուղին",
    "tracks.sub": "Յուրաքանչյուր ուղի կարճ դասերի հաջորդականություն է՝ հարցաշարերով։ Սկսի՛ր որտեղից ուզում ես — առաջընթացդ պահպանվում է այս սարքում։",
    "missions.title": "🛰️ Առաքելություններ. որտեղ ուղիները խաչվում են",
    "missions.sub": "Իրական խնդիրներ, որոնք միանգամից երկու ուղու գիտելիք են պահանջում — սովորի՛ր ալգորիթմներ, սովորի՛ր վեբ, հետո կառուցի՛ր այն, ինչ պահանջում է երկուսն էլ։ Ամեն առաքելություն բացվում է՝ նշված դասերն ավարտելուց հետո։",
    "badges.title": "🏅 Նվաճումներ",
    "badges.sub": "Վաստակվում են գործով, ոչ թե պարզապես ներկայանալով։",
    "features.title": "Կառուցված է այնպես, ինչպես իրականում աշխատում է սովորելը",
    "features.sub": "Կառուցվածքը զարդարանք չէ — ամեն տարր հիմնված է ուսուցման գիտության որևէ սկզբունքի վրա։",
    "f1.title": "Կարճ, կուռ դասեր",
    "f1.body": "10–15 րոպեանոց դասերը թեթև են պահում ճանաչողական բեռը։ Մեկ դաս — մեկ գլխավոր գաղափար՝ բացատրված հիմքից։",
    "f2.title": "Ակտիվ վերհիշում",
    "f2.body": "Ամեն դաս ավարտվում է հարցաշարով։ Հիշողությունից վերհանելը գիտելիքն ամրապնդում է շատ ավելի, քան վերընթերցումը։",
    "f3.title": "Տեսանելի առաջընթաց",
    "f3.body": "Առաջընթացի օղակները, ավարտի նշաններն ու շարքերը վերացական ճանապարհը դարձնում են շոշափելի։",
    "f4.title": "Կապակցված գաղափարներ",
    "f4.body": "Ուղիները հղվում են իրար — գրադիենտային վայրէջքը հայտնվում է ML-ում, վերադառնում DL-ում և աշխատում գործակալների ուղում։ Կրկնություն՝ խորությամբ։",
    "footer.left": "1991 Academy — կառուցված սովորելու հաճույքի համար։",
    "footer.right": "Առաջընթացը պահվում է քո դիտարկիչում։ Զրոյացնելու համար մաքրի՛ր կայքի տվյալները։",
    /* dashboard */
    "/ {0} XP today": "/ {0} XP այսօր",
    "daily goal: {0} XP · change": "օրական նպատակ՝ {0} XP · փոխել",
    "Level {0} · {1}": "Մակարդակ {0} · {1}",
    "{0} / {1} XP to {2}": "{0} / {1} XP մինչև {2}",
    "Max level — legendary": "Առավելագույն մակարդակ — լեգենդար",
    "▶ Continue: {0}": "▶ Շարունակել՝ {0}",
    "🏆 All lessons done — missions await": "🏆 Բոլոր դասերն ավարտված են — առաքելություններն սպասում են",
    "🧠 Practice": "🧠 Կրկնություն",
    "🧪 Lab": "🧪 Լաբ",
    "🛰️ Missions": "🛰️ Առաքելություններ",
    "lessons completed": "ավարտված դաս",
    "of focused study": "կենտրոնացված ուսում",
    "current streak": "ընթացիկ շարք",
    "lifetime experience": "ընդհանուր փորձ",
    "{0} day": "{0} օր",
    "{0} days": "{0} օր",
    "{0}/{1} lessons": "{0}/{1} դաս",
    "~{0} min": "~{0} րոպե",
    "{0} modules": "{0} մոդուլ",
    /* track page */
    "Track progress": "Ուղու առաջընթաց",
    "Lesson {0} of {1}": "Դաս {0}՝ {1}-ից",
    "⏱ {0} min read": "⏱ {0} րոպե",
    "🧠 {0}-question quiz": "🧠 {0} հարց",
    "🎬 {0} video(s)": "🎬 {0} տեսադաս",
    "🎬 Video lessons": "🎬 Տեսադասեր",
    "Hand-picked free courses from the best teachers — click and watch right here.": "Խնամքով ընտրված անվճար դասընթացներ լավագույն ուսուցիչներից — սեղմի՛ր ու դիտի՛ր հենց այստեղ։",
    "📂 Course materials": "📂 Դասընթացի նյութեր",
    "Key takeaways": "Գլխավոր մտքերը",
    "🧠 Check yourself": "🧠 Ստուգի՛ր ինքդ քեզ",
    "Active recall beats re-reading. Answer before you peek.": "Ակտիվ վերհիշումն ավելի ուժեղ է, քան վերընթերցումը։ Պատասխանի՛ր՝ նախքան նայելը։",
    "← Previous": "← Նախորդը",
    "Next →": "Հաջորդը →",
    "Mark as complete": "Նշել որպես ավարտված",
    "✓ Completed": "✓ Ավարտված",
    "Navigate with <kbd>[</kbd> and <kbd>]</kbd>.": "Տեղաշարժվի՛ր <kbd>[</kbd> և <kbd>]</kbd> ստեղներով",
    "✓ Nice! {0}/{1} lessons done.": "✓ Կեցցե՛ս։ {0}/{1} դաս ավարտված է։",
    "🏆 Track complete — outstanding!": "🏆 Ուղին ավարտված է — փայլո՛ւն։",
    "🎉 Perfect — {0}/{1}!": "🎉 Կատարյալ — {0}/{1}։",
    "You scored {0}/{1}.": "Արդյունքդ՝ {0}/{1}։",
    " +{0} XP.": " +{0} XP։",
    " ✨ perfect bonus included!": " ✨ բոնուսը ներառված է։",
    " Mark the lesson complete.": " Նշի՛ր դասն ավարտված։",
    " Skim the lesson once more, then move on.": " Աչքի անցկացրու դասը ևս մեկ անգամ ու շարունակի՛ր։",
    "🛠️ Exercise solved! +15 XP": "🛠️ Վարժությունը լուծված է։ +15 XP",
    "✓ Solved again — still got it.": "✓ Կրկին լուծված է — ձեռքդ տեղն է։",
    /* exercises */
    "Check": "Ստուգել",
    "Reset": "Զրոյացնել",
    "✓ Exactly right!": "✓ Միանգամայն ճիշտ է։",
    "Use every line.": "Օգտագործի՛ր բոլոր տողերը։",
    "Not quite — check the order.": "Ոչ այնքան — ստուգի՛ր հերթականությունը։",
    "click lines below to build the solution…": "սեղմի՛ր ներքևի տողերը՝ լուծումը կառուցելու համար…",
    "empty": "դատարկ",
    "Your solution (top to bottom)": "Քո լուծումը (վերևից ներքև)",
    "Available lines": "Հասանելի տողերը",
    "✓ Compiles in your head!": "✓ Կոմպիլացվում է մտքիդ մեջ։",
    "Red blanks need another look.": "Կարմիր դաշտերին ևս մեկ հայացք գցի՛ր։",
    "✓ All pairs matched!": "✓ Բոլոր զույգերը գտնված են։",
    "Show worked answer": "Ցույց տալ լուծումը",
    "Hide worked answer": "Թաքցնել լուծումը",
    "I solved it ✓": "Ես լուծեցի ✓",
    "Worked answer": "Լուծում",
    "✓ Nice work — self-checked.": "✓ Լավ աշխատանք — ինքնաստուգված։",
    "▶ Run tests": "▶ Թեստավորել",
    "Running…": "Կատարվում է…",
    "✓ All {0} tests pass!": "✓ Բոլոր {0} թեստերն անցան։",
    "{0}/{1} passing.": "{0}/{1} թեստ է անցնում։",
    "Error — see below.": "Սխալ — տե՛ս ներքևում։",
    "No tests ran — is your function named correctly?": "Ոչ մի թեստ չաշխատեց — ֆունկցիայիդ անունը ճի՞շտ է։",
    "✓ solved": "✓ լուծված",
    "This exercise needs the code runtime — open it from its track page.": "Այս վարժությանը կոդի միջավայր է պետք — բացի՛ր այն իր ուղու էջից։",
    /* pyodide / python runner status */
    "Downloading the Python runtime (~10 MB, first time only)…": "Ներբեռնվում է Python-ի միջավայրը (~10 ՄԲ, միայն առաջին անգամ)…",
    "Python runtime is still loading…": "Python-ի միջավայրը դեռ բեռնվում է…",
    "Timed out — an infinite loop somewhere?": "Ժամանակը սպառվեց — ինչ-որ տեղ անվերջ ցի՞կլ կա։",
    "Could not load the Python runtime (offline?). JavaScript still works!": "Չհաջողվեց բեռնել Python-ի միջավայրը (անցանց ես՞)։ JavaScript-ը դեռ աշխատում է։",
    /* practice */
    "Session complete": "Փուլն ավարտված է",
    "{0}/{1} correct · +{2} XP earned.": "{0}/{1} ճիշտ · +{2} XP վաստակած։",
    "Every correct answer pushes the card further into the future — that's spaced repetition at work.": "Յուրաքանչյուր ճիշտ պատասխան քարտը տեղափոխում է ավելի հեռու ապագա — այդպես է աշխատում ինտերվալային կրկնությունը։",
    "Another round ({0} due)": "Եվս մեկ փուլ ({0} քարտ)",
    "Home": "Գլխավոր",
    "Browse tracks": "Դիտել ուղիները",
    "Nothing due right now": "Այս պահին կրկնելու ոչինչ չկա",
    "Nothing to review yet": "Դեռ կրկնելու բան չկա",
    "Your memory is fresh. Next review {0}.": "Հիշողությունդ թարմ է։ Հաջորդ կրկնությունը՝ {0}։",
    "Complete more lessons to grow your review deck.": "Ավարտի՛ր ավելի շատ դասեր՝ քարտերի հավաքածուդ մեծացնելու համար։",
    "Finish a few lessons first — their questions become your personal review cards, scheduled for just before you'd forget them.": "Սկզբում ավարտի՛ր մի քանի դաս — դրանց հարցերը կդառնան քո անձնական կրկնության քարտերը՝ պլանավորված հենց մոռանալուցդ առաջ։",
    "now": "հիմա",
    "in {0} min": "{0} րոպեից",
    "in {0} h": "{0} ժամից",
    "in {0} days": "{0} օրից",
    "Finish": "Ավարտել",
    "Revisit lesson": "Վերադառնալ դասին",
    /* xp: levels, badges, toasts */
    "Achievement unlocked: {0}!": "Նվաճում բացվեց՝ {0}։",
    "Spark": "Կայծ", "Curious": "Հետաքրքրասեր", "Learner": "Սովորող", "Explorer": "Հետազոտող",
    "Builder": "Կառուցող", "Hacker": "Հաքեր", "Engineer": "Ինժեներ", "Architect": "Ճարտարապետ",
    "Master": "Վարպետ", "Sage": "Իմաստուն",
    "First Steps": "Առաջին քայլերը", "Hands On": "Գործնականում", "Sharpshooter": "Դիպուկահար",
    "Deadeye": "Անվրեպ", "Shipped It": "Առաքված է", "Mission Control": "Առաքելությունների կենտրոն",
    "On a Roll": "Թափի մեջ", "Unstoppable": "Անկասելի", "Force of Nature": "Բնության ուժ",
    "Renaissance Mind": "Վերածննդի միտք", "Track Champion": "Ուղու չեմպիոն", "Memory Athlete": "Հիշողության մարզիկ",
    "Lab Rat": "Լաբի մկնիկ", "Mad Scientist": "Խենթ գիտնական", "From Scratch": "Զրոյից",
    "Complete your first lesson": "Ավարտի՛ր առաջին դասդ",
    "Solve your first interactive exercise": "Լուծի՛ր առաջին ինտերակտիվ վարժությունդ",
    "Ace a quiz on the first try": "Անսխալ անցի՛ր հարցաշարն առաջին փորձից",
    "Ace 5 quizzes": "Անսխալ անցի՛ր 5 հարցաշար",
    "Complete your first mission": "Ավարտի՛ր առաջին առաքելությունդ",
    "Complete every mission": "Ավարտի՛ր բոլոր առաքելությունները",
    "3-day streak": "3 օր անընդմեջ",
    "7-day streak": "7 օր անընդմեջ",
    "30-day streak": "30 օր անընդմեջ",
    "Complete lessons in 3 different tracks": "Ավարտի՛ր դասեր 3 տարբեր ուղիներում",
    "Finish an entire track": "Ավարտի՛ր մի ամբողջ ուղի",
    "Answer 25 practice reviews": "Պատասխանի՛ր կրկնության 25 հարցի",
    "Solve your first Lab problem": "Լուծի՛ր Լաբի առաջին խնդիրդ",
    "Solve 8 Lab problems": "Լուծի՛ր Լաբի 8 խնդիր",
    "Train a model you built yourself": "Վարժեցրո՛ւ քո իսկ կառուցած մոդելը",
    /* sync status */
    "Couldn't sync to your account. Your progress is safe on this device.": "Չհաջողվեց համաժամացնել հաշվիդ հետ։ Առաջընթացդ ապահով է այս սարքում։",
    "Signed out — your progress is safe on this device.": "Ելք կատարվեց — առաջընթացդ ապահով է այս սարքում։",
    "Progress synced. {0} large code draft(s) stayed on this device.": "Առաջընթացը համաժամացվեց։ {0} մեծ սևագիր մնաց այս սարքում։",
    /* lab & missions */
    "🧪 The Lab": "🧪 Լաբորատորիա",
    "Don't just read about algorithms and models — write them in <strong>JavaScript or Python</strong>, test them, and <strong>watch your own code run</strong>. ": "Մի՛ կարդա ալգորիթմների ու մոդելների մասին — գրի՛ր դրանք <strong>JavaScript-ով կամ Python-ով</strong>, թեստավորի՛ր և <strong>դիտի՛ր, թե ինչպես է աշխատում քո սեփական կոդը</strong>։ ",
    "{0} of {1} solved.": "{0}/{1} լուծված։",
    "All": "Բոլորը",
    "Algorithms": "Ալգորիթմներ",
    "Machine Learning": "Մեքենայական ուսուցում",
    "Deep Learning": "Խորը ուսուցում",
    "Easy": "Հեշտ", "Medium": "Միջին", "Hard": "Բարդ",
    "📊 visual": "📊 վիզուալ",
    "✓ Solved · {0} XP earned": "✓ Լուծված · {0} XP",
    "▶ Reward {0} XP": "▶ Պարգև՝ {0} XP",
    "← All problems": "← Բոլոր խնդիրները",
    "📊 Visualize my code": "📊 Պատկերացրո՛ւ կոդս",
    "Reset code": "Զրոյացնել կոդը",
    "Hint {0}": "Հուշում {0}",
    " Now hit Visualize →": " Հիմա սեղմի՛ր «Պատկերացրո՛ւ» →",
    "🧪 Solved! +{0} XP": "🧪 Լուծված է։ +{0} XP",
    /* lab visualization captions */
    "swap {0} of {1}": "փոխատեղում {0} / {1}",
    " — sorted! 🎉": " — դասավորված է։ 🎉",
    "step {0} / {1}": "քայլ {0} / {1}",
    " — shortest path found! 🎉": " — ամենակարճ ուղին գտնված է։ 🎉",
    "Your function returned no path for this maze — but one exists. Keep going!": "Ֆունկցիադ ուղի չվերադարձրեց այս լաբիրինթոսի համար — բայց ուղի կա։ Շարունակի՛ր։",
    "gradient step {0} / {1}": "գրադիենտային քայլ {0} / {1}",
    " — converged 🎉": " — զուգամիտեց 🎉",
    "iteration {0} / {1}": "կրկնություն {0} / {1}",
    "your decision boundary, k = {0} 🎉": "քո որոշման սահմանը, k = {0} 🎉",
    "painting the plane… {0}%": "հարթությունը ներկվում է… {0}%",
    "epoch {0}": "դարաշրջան {0}",
    "epoch {0} / {1}": "դարաշրջան {0} / {1}",
    " — separated 🎉": " — տարանջատված է 🎉",
    "loss over {0} epochs": "կորուստը {0} դարաշրջանում",
    "final: {0}": "վերջնական՝ {0}",
    "your network's map of the plane — corners predict {0} 🎉": "քո ցանցի հարթության քարտեզը — անկյունները կանխատեսում են {0} 🎉",
    "running your Python…": "կատարվում է քո Python-ը…",
    "Real problems that need knowledge from more than one track — this is where the lessons click together. ": "Իրական խնդիրներ, որոնք պահանջում են մեկից ավելի ուղու գիտելիք — հենց այստեղ են դասերը իրար կպչում։ ",
    "{0} of {1} unlocked.": "{0}/{1} բացված։",
    "✓ Completed · {0} XP earned": "✓ Ավարտված · {0} XP",
    "▶ Ready · reward {0} XP": "▶ Պատրաստ · պարգև՝ {0} XP",
    "🔒 Unlocks after: ": "🔒 Կբացվի հետո՝ ",
    "← All missions": "← Բոլոր առաքելությունները",
    "🚀 Mission complete! +{0} XP": "🚀 Առաքելությունն ավարտված է։ +{0} XP",
    "✓ completed": "✓ ավարտված",
    /* leaderboard */
    "lb.title": "🏆 Առաջատարներ",
    "lb.sub": "Սովորողներ, ովքեր միացել են ցուցակին՝ դասավորված ընդհանուր XP-ով։ Միացի՛ր քո հաշվի էջից։",
    "Your rank: #{0}": "Քո տեղը՝ #{0}",
    "Show me on the leaderboard": "Ցուցադրի՛ր ինձ առաջատարների ցուցակում",
    "Couldn't save that — check your connection.": "Չհաջողվեց պահպանել — ստուգի՛ր կապը։",
    "This exercise could not be loaded.": "Այս վարժությունը չհաջողվեց բեռնել։",
    /* account */
    "Your progress, everywhere": "Քո առաջընթացը՝ ամենուր",
    "Create a free account and your XP, streak, completed lessons and mission codes follow you to any device. All guest progress stays on this device only.": "Ստեղծի՛ր անվճար հաշիվ, և քո XP-ն, շարքը, ավարտված դասերն ու առաքելությունների կոդը կհետևեն քեզ ցանկացած սարքի վրա։ Հյուրերի ամբողջ առաջընթացը մնում է միայն այս սարքում։",
    "Welcome back — your streak missed you.": "Բարի վերադարձ — շարքդ կարոտել էր քեզ։",
    "Username or email": "Օգտանուն կամ էլ. փոստ",
    "Password": "Գաղտնաբառ",
    "Create account": "Ստեղծել հաշիվ",
    "Username": "Օգտանուն",
    "Email": "Էլ. փոստ",
    "Password (min 8 characters)": "Գաղտնաբառ (առնվազն 8 նիշ)",
    "Free forever. Your current progress on this device comes with you.": "Անվճար՝ ընդմիշտ։ Այս սարքի ընթացիկ առաջընթացդ կգա քեզ հետ։",
    "Sign out": "Ելք",
    "⟳ Sync now": "⟳ Համաժամացնել",
    "Your progress syncs to your account automatically, moments after each change. Sign in from any device to pick up where you left off. After signing out, a local copy stays on this device.": "Առաջընթացդ ավտոմատ համաժամացվում է հաշվիդ հետ ամեն փոփոխությունից քիչ անց։ Մուտք գործի՛ր ցանկացած սարքից՝ շարունակելու այնտեղից, որտեղ կանգնել էիր։ Ելքից հետո այս սարքում մնում է լոկալ պատճենը։",
    "Accounts need the 1991 Academy server": "Հաշիվներին պետք է 1991 Academy-ի սերվերը",
    "This page was opened without the backend, so sign-in is unavailable (your progress still saves on this device). To enable accounts, run this in the 1991 Academy folder:": "Այս էջը բացվել է առանց backend-ի, ուստի մուտքն անհասանելի է (առաջընթացդ դեռ պահվում է այս սարքում)։ Հաշիվները միացնելու համար 1991 Academy թղթապանակում գործարկի՛ր.",
    "member since {0}": "անդամ է {0}-ից",
    "✓ Synced at {0}": "✓ Համաժամացվեց {0}-ին",
    "Sync failed: {0}": "Համաժամացումը ձախողվեց՝ {0}",
    /* change password */
    "Change password": "Փոխել գաղտնաբառը",
    "Current password": "Ընթացիկ գաղտնաբառ",
    "New password (min 8 characters)": "Նոր գաղտնաբառ (առնվազն 8 նիշ)",
    "Confirm new password": "Հաստատի՛ր նոր գաղտնաբառը",
    "Update password": "Թարմացնել գաղտնաբառը",
    "✓ Password updated. Other devices were signed out.": "✓ Գաղտնաբառը թարմացվեց։ Մյուս սարքերից ելք կատարվեց։",
    "Passwords don't match.": "Գաղտնաբառերը չեն համընկնում։",
    /* forgot / reset password */
    "Forgot your password?": "Մոռացե՞լ ես գաղտնաբառդ։",
    "Reset your password": "Վերականգնի՛ր գաղտնաբառդ",
    "Enter your account email and we'll send a reset link.": "Մուտքագրի՛ր հաշվիդ էլ. փոստը, և մենք կուղարկենք վերականգնման հղում։",
    "Send reset link": "Ուղարկել վերականգնման հղում",
    "If that email is registered, a reset link is on its way.": "Եթե այդ էլ. փոստը գրանցված է, վերականգնման հղումն արդեն ճանապարհին է։",
    "Set a new password": "Սահմանի՛ր նոր գաղտնաբառ",
    "Choose a new password for your account.": "Ընտրի՛ր նոր գաղտնաբառ քո հաշվի համար։",
    "Save new password": "Պահել նոր գաղտնաբառը",
    "Password reset": "Գաղտնաբառը վերականգնվեց",
    "Sign in with your new password.": "Մուտք գործի՛ր նոր գաղտնաբառով։",
    /* danger zone / delete */
    "Danger zone": "Վտանգավոր գոտի",
    "Deleting your account permanently removes it and your synced progress from the server. This cannot be undone.": "Հաշվի ջնջումը ընդմիշտ հեռացնում է այն և քո համաժամացված առաջընթացը սերվերից։ Սա հնարավոր չէ հետարկել։",
    "Delete account": "Ջնջել հաշիվը",
    "Type your password to confirm": "Հաստատելու համար մուտքագրի՛ր գաղտնաբառդ",
    "Yes, delete my account": "Այո՛, ջնջել իմ հաշիվը",
    "Cancel": "Չեղարկել",
    "Account deleted": "Հաշիվը ջնջվեց",
    "Your account and synced progress are gone. This device's local progress remains.": "Քո հաշիվն ու համաժամացված առաջընթացը ջնջվել են։ Այս սարքի լոկալ առաջընթացը մնում է։",
    /* leaderboard periods */
    "This week": "Այս շաբաթ",
    "All time": "Ամբողջ ժամանակ",
    "No XP earned this week yet — be the first.": "Այս շաբաթ դեռ XP չի վաստակվել — եղի՛ր առաջինը։",
  };

  /* ---------- API ---------- */

  function fmt(s, args) {
    return s.replace(/\{(\d+)\}/g, (m, n) => (args[n] !== undefined ? args[n] : m));
  }

  function t(key, ...args) {
    const s = lang === "hy" ? (HY[key] !== undefined ? HY[key] : key) : key;
    return args.length ? fmt(s, args) : s;
  }

  /* Content lookup: obj.field_hy in Armenian mode when present */
  function L(obj, field) {
    if (lang === "hy" && obj && obj[field + "_hy"] != null) return obj[field + "_hy"];
    return obj ? obj[field] : "";
  }

  /* Static HTML: translate [data-i18n] elements (hy only; en leaves DOM untouched) */
  function applyStatic() {
    if (lang !== "hy") return;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n") || el.textContent.trim();
      const translated = HY[key];
      if (translated !== undefined) el.innerHTML = translated;
    });
    document.documentElement.setAttribute("lang", "hy");
  }

  function setLang(l) {
    localStorage.setItem(KEY, l);
    if (window.Sync) Sync.schedule();
    location.reload();
  }

  /* toggle button: shows the language you'd switch TO */
  let toggleBound = false;

  function initToggle() {
    document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
      btn.textContent = lang === "hy" ? "EN" : "ՀԱՅ";
      btn.title = lang === "hy" ? "Switch to English" : "Փոխել հայերենի";
    });
    if (toggleBound) return; // one document-level listener, however often we run
    toggleBound = true;
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-lang-toggle]")) setLang(lang === "hy" ? "en" : "hy");
    });
  }

  function start() {
    applyStatic();
    initToggle();
  }

  /* Scripts sit at the end of <body>, so readyState is normally "loading"
     here and DOMContentLoaded does the work. Both paths are idempotent. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  return { t, L, lang: () => lang, setLang };
})();

const t = I18N.t;
const L = I18N.L;
