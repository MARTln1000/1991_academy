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
  const KEY = "1991_academy:lang";
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
    "hero.title": 'Սովորի՛ր խորությամբ։<br /><span class="grad">Վայելի՛ր ընթացքը։</span>',
    "hero.sub": "Յոթ կառուցված ուղի — մաթեմատիկա, ծրագրավորում, վեբ, մեքենայական ուսուցում, խորը ուսուցում, ԱԲ գործակալներ և ալգորիթմներ — գումարած Լաբը, որտեղ մոդելներ ու ալգորիթմներ ես գրում Python-ով Google Colab-ում և տեսնում դրանք աշխատելիս։ Դասեր, տեսադասախոսություններ, հարցաշարեր, իրական կոդ։ Ոչ մի ավելորդ բան։",
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
    "credit.fast": "Դասընթացների նյութերը (դասախոսություններ, սլայդներ և տնային աշխատանքներ) ստեղծվել են FAST Foundation-ի կողմից։",
    "footer.support": '1991 Academy-ի սպասարկող՝ 1991 Ստորաբաժանում։ Ինչ-որ բան չի՞ աշխատում։ Գրի՛ր <a href="mailto:ai.1991@mil.am">ai.1991@mil.am</a> հասցեին։',
    "Privacy Policy": "Գաղտնիության քաղաքականություն",
    "What we store and why:": "Ինչ ենք պահում և ինչու՝",
    "footer.left": "1991 Academy — կառուցված սովորելու հաճույքի համար։",
    "footer.right": "Առաջընթացդ պահվում է քո հաշվում։",
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
    "✓ solved": "✓ լուծված",
    "This exercise needs the code runtime — open it from its track page.": "Այս վարժությանը կոդի միջավայր է պետք — բացի՛ր այն իր ուղու էջից։",
    /* code exercises: solved in Google Colab (js/colab.js) */
    "Download the notebook": "Ներբեռնել նոթբուքը",
    "Download the exercise's notebook:": "Ներբեռնի՛ր վարժության նոթբուքը՝",
    "Open Google Colab, choose <strong>File → Upload notebook</strong> and pick the file you downloaded ({0}). Colab saves it in your Google Drive, in the <em>Colab Notebooks</em> folder.": "Բացի՛ր Google Colab-ը, ընտրի՛ր <strong>File → Upload notebook</strong> և ընտրի՛ր ներբեռնածդ ֆայլը ({0})։ Colab-ն այն պահում է քո Google Drive-ում՝ <em>Colab Notebooks</em> թղթապանակում։",
    "Open Google Colab": "Բացել Google Colab-ը",
    "Solve it there: run your code, then the test cell. When every test passes, come back here:": "Լուծի՛ր այն այնտեղ. գործարկի՛ր կոդդ, հետո՝ թեստերի բջիջը։ Երբ բոլոր թեստերն անցնեն, վերադարձի՛ր այստեղ՝",
    "📊 The notebook also plots what your code does.": "📊 Նոթբուքը նաև պատկերում է, թե ինչ է անում կոդդ։",
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
    "Don't just read about algorithms and models — write them yourself in <strong>Python</strong> in Google Colab, test them, and <strong>plot what your own code does</strong>. ": "Մի՛ կարդա ալգորիթմների ու մոդելների մասին — գրի՛ր դրանք ինքդ <strong>Python-ով</strong> Google Colab-ում, թեստավորի՛ր և <strong>պատկերի՛ր, թե ինչ է անում քո սեփական կոդը</strong>։ ",
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
    "Hint {0}": "Հուշում {0}",
    "🧪 Solved! +{0} XP": "🧪 Լուծված է։ +{0} XP",
    /* lab visualization captions */
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
    /* sign-in page of a closed school: invitations instead of sign-up */
    "1991 Academy": "1991 Academy",
    "The online school of 1991 Unit. Sign in with the account your school created for you.": "1991 Ստորաբաժանման առցանց դպրոցը։ Մուտք գործի՛ր այն հաշվով, որը քեզ համար ստեղծել է դպրոցը։",
    "No account? Accounts are only for the school's students: ask your instructor, or write to {0}.": "Հաշիվ չունե՞ս։ Հաշիվները միայն դպրոցի ուսանողների համար են. դիմի՛ր դասավանդողիդ կամ գրի՛ր {0} հասցեին։",
    "Welcome to 1991 Academy": "Բարի գալուստ 1991 Academy",
    "Your username is {0}. Choose a password to finish setting up your account.": "Քո օգտանունն է՝ {0}։ Ընտրի՛ր գաղտնաբառ՝ հաշիվդ կարգավորելն ավարտելու համար։",
    "Start learning": "Սկսել սովորել",
    "This invitation link has expired": "Հրավերի այս հղումը ժամկետանց է",
    "Ask your instructor for a new one, or write to {0}.": "Նորը խնդրի՛ր դասավանդողիդ կամ գրի՛ր {0} հասցեին։",
    /* the redesigned sign-in / new-password pages */
    "New password": "Նոր գաղտնաբառ",
    "Type it again": "Կրկնի՛ր այն",
    "At least 8 characters": "Առնվազն 8 նիշ",
    "Both passwords match": "Երկու գաղտնաբառերը համընկնում են",
    "Show": "Ցույց տալ",
    "Hide": "Թաքցնել",
    "Your username": "Քո օգտանունը",
    "Choose a password to finish setting up your account.": "Ընտրի՛ր գաղտնաբառ՝ հաշիվդ կարգավորելն ավարտելու համար։",
    "Choose a new password": "Ընտրի՛ր նոր գաղտնաբառ",
    "You can sign in with your username or your email.": "Կարող ես մուտք գործել օգտանունով կամ էլ. փոստով։",
    "This link has expired": "Այս հղումը ժամկետանց է",
    "Reset links work for one hour, once. Ask for a new one on the sign-in page.": "Վերականգնման հղումը գործում է մեկ ժամ և մեկ անգամ։ Նորը խնդրի՛ր մուտքի էջում։",
    "Password saved": "Գաղտնաբառը պահպանվեց",
    /* temporary passwords (from an admin) */
    "Choose your own password": "Ընտրի՛ր քո սեփական գաղտնաբառը",
    "You signed in with a temporary password. Choose your own to continue: you'll sign in with it from now on.": "Մուտք գործեցիր ժամանակավոր գաղտնաբառով։ Շարունակելու համար ընտրի՛ր քո սեփականը. այսուհետ մուտք կգործես դրանով։",
    "Not the temporary password": "Ժամանակավոր գաղտնաբառից տարբեր",
    "Forgot your password? Your instructor can give you a new temporary password.": "Մոռացե՞լ ես գաղտնաբառդ։ Դասավանդողդ կարող է քեզ տալ նոր ժամանակավոր գաղտնաբառ։",
    "This temporary password has expired. Ask your instructor for a new one.": "Այս ժամանակավոր գաղտնաբառը ժամկետանց է։ Նորը խնդրի՛ր դասավանդողիդ։",
    "Choose a password different from the temporary one.": "Ընտրի՛ր ժամանակավորից տարբեր գաղտնաբառ։",
    "Choose your own password to continue.": "Շարունակելու համար ընտրի՛ր քո սեփական գաղտնաբառը։",
    /* invitation links (account.html#join=…) */
    "Join 1991 Academy": "Միացի՛ր 1991 Academy-ին",
    "Checking your link…": "Հղումը ստուգվում է…",
    "This link can't be used": "Այս հղումը հնարավոր չէ օգտագործել",
    "You're signed in as {0}. This link makes a new account: sign out first if it's meant for you.":
      "Մուտք ես գործել որպես {0}։ Այս հղումը նոր հաշիվ է ստեղծում. եթե այն քեզ համար է, նախ դուրս եկ։",
    "Your instructor sent you this link. Type the email you want to use (one you'll keep: temporary email addresses aren't accepted). Your account is made for it. The link works only once.":
      "Այս հղումը քեզ ուղարկել է դասավանդողդ։ Գրի՛ր այն էլ. հասցեն, որը ցանկանում ես օգտագործել (մշտական հասցե. ժամանակավոր էլ. հասցեներն ընդունելի չեն)։ Հաշիվդ կստեղծվի դրա համար։ Հղումը գործում է միայն մեկ անգամ։",
    "Username (optional)": "Օգտանուն (ըստ ցանկության)",
    "3–20 letters, digits or _. Others see it on the leaderboard. Leave it empty to make one from your email.":
      "3–20 տառ, թիվ կամ _։ Այն երևում է առաջատարների ցուցակում։ Թող դատարկ, և այն կկազմվի էլ. հասցեիցդ։",
    "Create my account": "Ստեղծել իմ հաշիվը",
    "Your account is ready": "Հաշիվդ պատրաստ է",
    "Your temporary password": "Քո ժամանակավոր գաղտնաբառը",
    "If you stop here, sign in later with {0} and this temporary password, within {1} days.":
      "Եթե հիմա կանգ առնես, ավելի ուշ մուտք գործի՛ր {0}-ով և այս ժամանակավոր գաղտնաբառով՝ {1} օրվա ընթացքում։",
    "Continue: choose your own password": "Շարունակել՝ ընտրել իմ գաղտնաբառը",
    "This link doesn't work. Check that you opened the whole link, or ask your instructor for a new one.":
      "Այս հղումը չի աշխատում։ Ստուգի՛ր, որ բացել ես ամբողջ հղումը, կամ նորը խնդրի՛ր դասավանդողիդ։",
    "This link has already been used. If that wasn't you, tell your instructor.":
      "Այս հղումն արդեն օգտագործվել է։ Եթե դա դու չէիր, տեղեկացրո՛ւ դասավանդողիդ։",
    "This link has expired. Ask your instructor for a new one.": "Այս հղումը ժամկետանց է։ Նորը խնդրի՛ր դասավանդողիդ։",
    "This link was cancelled. Ask your instructor for a new one.": "Այս հղումը չեղարկվել է։ Նորը խնդրի՛ր դասավանդողիդ։",
    "That doesn't look like an email address.": "Սա էլ. հասցեի նման չէ։",
    "Temporary email addresses can't be used. Use an address you'll keep.":
      "Ժամանակավոր էլ. հասցեներ չեն կարող օգտագործվել։ Օգտագործի՛ր հասցե, որը կպահես։",
    /* messages from the server */
    "Wrong credentials.": "Սխալ օգտանուն կամ գաղտնաբառ։",
    "This reset link is invalid or has expired.": "Այս հղումն անվավեր է կամ ժամկետանց։",
    "This link is invalid or has expired. Ask for a new one.": "Այս հղումն անվավեր է կամ ժամկետանց։ Խնդրի՛ր նորը։",
    "Password must be at least 8 characters.": "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ։",
    "Too many login attempts — wait a minute.": "Չափից շատ փորձեր — սպասի՛ր մեկ րոպե։",
    "Too many attempts — try again later.": "Չափից շատ փորձեր — փորձի՛ր ավելի ուշ։",
    "Too many wrong passwords for this account — wait 15 minutes.": "Այս հաշվի համար չափից շատ սխալ գաղտնաբառեր — սպասի՛ր 15 րոպե։",
    "Too many reset requests — try again later.": "Չափից շատ վերականգնման հարցումներ — փորձի՛ր ավելի ուշ։",
    "not signed in": "մուտք գործած չես",
    /* admin link in the nav, announcement banner */
    "Admin": "Ադմին",
    "Dismiss": "Փակել",
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

  /* More strings for one page (the admin panel keeps its own, js/i18n-admin.js) */
  function extend(dict) {
    Object.assign(HY, dict);
  }

  return { t, L, lang: () => lang, setLang, extend };
})();

const t = I18N.t;
const L = I18N.L;
