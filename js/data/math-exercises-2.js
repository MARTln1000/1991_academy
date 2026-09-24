/* 1991 Academy — Homework problems for Mathematics for ML, modules 2–4
   (Calculus, Probability & Statistics, Signals & Fourier).
   Extracted from the FAST course problem sets (Homeworks 5–11). Every
   numeric answer below was verified against numpy before publishing.
   type:"problem" = attempt on paper → reveal worked answer → self-check.
   Bilingual: statement_hy / solution_hy translate the prose; KaTeX markup
   is byte-identical. LaTeX via String.raw. Load AFTER math-exercises.js. */
(function () {
  const r = String.raw;
  const track = window.MARTINIUM && window.MARTINIUM.tracks && window.MARTINIUM.tracks.math;
  if (!track) return;
  const byId = {};
  for (const m of track.modules) for (const l of m.lessons) byId[l.id] = l;

  const EX = {
    /* ============ Module 2 · Calculus & Optimization ============ */

    "math-2-1": [
      {
        type: "problem",
        title: "A 1^∞ sequence limit",
        title_hy: "1^∞ տեսքի հաջորդականության սահման",
        source: "HW 5 · Problem 2d",
        prompt: "Take logs — it's a 1 to the infinity form.",
        prompt_hy: "Վերցրո՛ւ լոգարիթմ — սա 1-ը անվերջության աստիճան տեսք է։",
        statement: r`<p>Compute \[ \lim_{n\to\infty}\left(\frac{\sqrt[n]{2}+\sqrt[n]{3}}{2}\right)^{n}. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \lim_{n\to\infty}\left(\frac{\sqrt[n]{2}+\sqrt[n]{3}}{2}\right)^{n}. \]</p>`,
        solution: r`<p>The base \(\to 1\), so this is a \(1^{\infty}\) form. Using \(\sqrt[n]{a}=e^{\ln a/n}=1+\tfrac{\ln a}{n}+o(\tfrac1n)\),</p>
\[ \frac{\sqrt[n]{2}+\sqrt[n]{3}}{2}=1+\frac{\ln 2+\ln 3}{2n}+o\!\left(\tfrac1n\right)=1+\frac{\ln 6}{2n}+o\!\left(\tfrac1n\right). \]
<p>Hence the limit is \(\exp\!\big(\lim_{n}n\cdot\tfrac{\ln 6}{2n}\big)=e^{\frac{\ln 6}{2}}\):</p>
\[ \boxed{\;\sqrt{6}\;}\approx 2.449. \]`,
        solution_hy: r`<p>Հիմքը \(\to 1\), ուստի սա \(1^{\infty}\) տեսք է։ Օգտագործելով \(\sqrt[n]{a}=e^{\ln a/n}=1+\tfrac{\ln a}{n}+o(\tfrac1n)\)՝</p>
\[ \frac{\sqrt[n]{2}+\sqrt[n]{3}}{2}=1+\frac{\ln 2+\ln 3}{2n}+o\!\left(\tfrac1n\right)=1+\frac{\ln 6}{2n}+o\!\left(\tfrac1n\right). \]
<p>Հետևաբար սահմանը \(\exp\!\big(\lim_{n}n\cdot\tfrac{\ln 6}{2n}\big)=e^{\frac{\ln 6}{2}}\) է.</p>
\[ \boxed{\;\sqrt{6}\;}\approx 2.449. \]`,
      },
      {
        type: "problem",
        title: "Another 1^∞ limit",
        title_hy: "ԵՒս մեկ 1^∞ սահման",
        source: "HW 5 · Problem 2 (family)",
        prompt: "Write the base as 1 + (small), then take n² · (small).",
        prompt_hy: "Հիմքը գրի՛ր որպես 1 + (փոքր), հետո վերցրո՛ւ n² · (փոքր)։",
        statement: r`<p>Compute \[ \lim_{n\to\infty}\left(\frac{n^{2}-1}{n^{2}+1}\right)^{n^{2}}. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \lim_{n\to\infty}\left(\frac{n^{2}-1}{n^{2}+1}\right)^{n^{2}}. \]</p>`,
        solution: r`<p>The base is \(1-\dfrac{2}{n^{2}+1}\). With \((1+a_n)^{b_n}\to e^{\lim a_n b_n}\),</p>
\[ \lim_{n\to\infty} n^{2}\cdot\left(-\frac{2}{n^{2}+1}\right)=-2, \]
<p>so the limit is</p>
\[ \boxed{\,e^{-2}\,}\approx 0.135. \]`,
        solution_hy: r`<p>Հիմքը \(1-\dfrac{2}{n^{2}+1}\) է։ \((1+a_n)^{b_n}\to e^{\lim a_n b_n}\)-ով՝</p>
\[ \lim_{n\to\infty} n^{2}\cdot\left(-\frac{2}{n^{2}+1}\right)=-2, \]
<p>ուստի սահմանը</p>
\[ \boxed{\,e^{-2}\,}\approx 0.135. \]`,
      },
    ],

    "math-2-2": [
      {
        type: "problem",
        title: "A 0/0 limit",
        title_hy: "0/0 սահման",
        source: "HW 5 · Problem 2a",
        prompt: "Factor tan − sin, then use 1 − cos x ~ x²/2 and sin x ~ x.",
        prompt_hy: "Վերլուծի՛ր tan − sin, հետո օգտագործի՛ր 1 − cos x ~ x²/2 և sin x ~ x։",
        statement: r`<p>Compute \[ \lim_{x\to 0}\frac{\tan x-\sin x}{\sin^{3}x}. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \lim_{x\to 0}\frac{\tan x-\sin x}{\sin^{3}x}. \]</p>`,
        solution: r`<p>Factor the numerator:</p>
\[ \tan x-\sin x=\sin x\left(\frac{1}{\cos x}-1\right)=\frac{\sin x\,(1-\cos x)}{\cos x}. \]
<p>Divide by \(\sin^{3}x\) and use \(1-\cos x\sim\tfrac{x^{2}}{2}\), \(\sin^{2}x\sim x^{2}\), \(\cos x\to 1\):</p>
\[ \frac{1-\cos x}{\cos x\,\sin^{2}x}\;\longrightarrow\;\frac{x^{2}/2}{x^{2}}=\boxed{\tfrac12}. \]`,
        solution_hy: r`<p>Վերլուծի՛ր համարիչը.</p>
\[ \tan x-\sin x=\sin x\left(\frac{1}{\cos x}-1\right)=\frac{\sin x\,(1-\cos x)}{\cos x}. \]
<p>Բաժանի՛ր \(\sin^{3}x\)-ի և օգտագործի՛ր \(1-\cos x\sim\tfrac{x^{2}}{2}\), \(\sin^{2}x\sim x^{2}\), \(\cos x\to 1\).</p>
\[ \frac{1-\cos x}{\cos x\,\sin^{2}x}\;\longrightarrow\;\frac{x^{2}/2}{x^{2}}=\boxed{\tfrac12}. \]`,
      },
      {
        type: "problem",
        title: "Make it continuous",
        title_hy: "Դարձրո՛ւ անընդհատ",
        source: "HW 5 · Problem 3",
        prompt: "Only the junction |x| = 1 can break continuity. Match the two pieces there.",
        prompt_hy: "Անընդհատությունը կարող է խախտվել միայն |x| = 1 կցման կետում։ Համապատասխանեցրո՛ւ երկու կտորները այնտեղ։",
        statement: r`<p>For which values of \(a\) is the function continuous on \(\mathbb{R}\)?</p>
\[ f(x)=\begin{cases}\sin|x|-\ln|x|, & |x|\ge 1,\\[2pt] a x^{2}-1, & |x|<1.\end{cases} \]`,
        statement_hy: r`<p>\(a\)-ի ո՞ր արժեքների դեպքում է ֆունկցիան անընդհատ \(\mathbb{R}\)-ի վրա.</p>
\[ f(x)=\begin{cases}\sin|x|-\ln|x|, & |x|\ge 1,\\[2pt] a x^{2}-1, & |x|<1.\end{cases} \]`,
        solution: r`<p>Each piece is continuous on its open region, so only the junction \(|x|=1\) matters. At \(x=1\): the inner piece gives \(a\cdot 1-1=a-1\); the outer gives \(\sin 1-\ln 1=\sin 1\). Continuity requires them equal:</p>
\[ a-1=\sin 1\;\Longrightarrow\;\boxed{\,a=1+\sin 1\,}\approx 1.841. \]
<p>By evenness of \(f\), the junction at \(x=-1\) gives the same condition.</p>`,
        solution_hy: r`<p>Ամեն կտոր անընդհատ է իր բաց տիրույթում, ուստի կարևոր է միայն \(|x|=1\) կցումը։ \(x=1\)-ում՝ ներքին կտորը տալիս է \(a\cdot 1-1=a-1\); արտաքինը՝ \(\sin 1-\ln 1=\sin 1\)։ Անընդհատությունը պահանջում է դրանց հավասարությունը.</p>
\[ a-1=\sin 1\;\Longrightarrow\;\boxed{\,a=1+\sin 1\,}\approx 1.841. \]
<p>\(f\)-ի զույգության շնորհիվ \(x=-1\) կցումը տալիս է նույն պայմանը։</p>`,
      },
    ],

    "math-2-3": [
      {
        type: "problem",
        title: "Extremum points",
        title_hy: "Էքստրեմումի կետեր",
        source: "HW 5 · Problem 6a",
        prompt: "Solve f' = 0, classify with the sign of f''.",
        prompt_hy: "Լուծի՛ր f' = 0, դասակարգի՛ր f''-ի նշանով։",
        statement: r`<p>Find all extremum points of \( f(x)=2x^{2}-x^{4}. \)</p>`,
        statement_hy: r`<p>Գտի՛ր \( f(x)=2x^{2}-x^{4} \)-ի բոլոր էքստրեմումի կետերը։</p>`,
        solution: r`<p>\( f'(x)=4x-4x^{3}=4x(1-x^{2}) \), so the critical points are \(x=0,\pm 1\). With \(f''(x)=4-12x^{2}\):</p>
\[ f''(0)=4>0\;\Rightarrow\;\text{local min},\quad f(0)=0, \]
\[ f''(\pm 1)=-8<0\;\Rightarrow\;\text{local max},\quad f(\pm 1)=1. \]
\[ \boxed{\ \min 0 \text{ at } x=0;\qquad \max 1 \text{ at } x=\pm 1.\ } \]`,
        solution_hy: r`<p>\( f'(x)=4x-4x^{3}=4x(1-x^{2}) \), ուստի կրիտիկական կետերն են \(x=0,\pm 1\)։ \(f''(x)=4-12x^{2}\)-ով.</p>
\[ f''(0)=4>0\;\Rightarrow\;\text{լոկալ մին},\quad f(0)=0, \]
\[ f''(\pm 1)=-8<0\;\Rightarrow\;\text{լոկալ մաքս},\quad f(\pm 1)=1. \]
\[ \boxed{\ \min 0 \text{ երբ } x=0;\qquad \max 1 \text{ երբ } x=\pm 1.\ } \]`,
      },
      {
        type: "problem",
        title: "Max & min on an interval",
        title_hy: "Մաքս և մին միջակայքում",
        source: "HW 5 · Problem 7b",
        prompt: "Check whether f' ever vanishes — its discriminant decides everything.",
        prompt_hy: "Ստուգի՛ր՝ արդյոք f'-ը երբևէ զրոյանում է — դրա դիսկրիմինանտը որոշում է ամեն ինչ։",
        statement: r`<p>Find the maximum and minimum values of \( f(x)=x^{3}-3x^{2}+6x-2 \) on \([-4,3]\).</p>`,
        statement_hy: r`<p>Գտի՛ր \( f(x)=x^{3}-3x^{2}+6x-2 \)-ի մաքսիմումն ու մինիմումը \([-4,3]\)-ի վրա։</p>`,
        solution: r`<p>\( f'(x)=3x^{2}-6x+6=3\big((x-1)^{2}+1\big)>0 \) for all \(x\), so \(f\) is strictly increasing. The extrema are therefore at the endpoints:</p>
\[ \min=f(-4)=-64-48-24-2=\boxed{-138},\qquad \max=f(3)=27-27+18-2=\boxed{16}. \]`,
        solution_hy: r`<p>\( f'(x)=3x^{2}-6x+6=3\big((x-1)^{2}+1\big)>0 \) բոլոր \(x\)-երի համար, ուստի \(f\)-ը խիստ աճող է։ Հետևաբար էքստրեմումները ծայրակետերում են.</p>
\[ \min=f(-4)=-64-48-24-2=\boxed{-138},\qquad \max=f(3)=27-27+18-2=\boxed{16}. \]`,
      },
    ],

    "math-2-4": [
      {
        type: "problem",
        title: "Integral by substitution",
        title_hy: "Ինտեգրալ տեղակալմամբ",
        source: "HW 6 · Problem 1b",
        prompt: "The x² and x⁶ beg for u = x³.",
        prompt_hy: "x²-ն ու x⁶-ը հուշում են u = x³ տեղակալումը։",
        statement: r`<p>Compute \[ \int_{0}^{1}\frac{x^{2}}{1+x^{6}}\,dx. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \int_{0}^{1}\frac{x^{2}}{1+x^{6}}\,dx. \]</p>`,
        solution: r`<p>Let \(u=x^{3}\), \(du=3x^{2}\,dx\). The bounds \(0,1\) map to \(0,1\):</p>
\[ \int_{0}^{1}\frac{x^{2}}{1+x^{6}}\,dx=\frac13\int_{0}^{1}\frac{du}{1+u^{2}}=\frac13\big[\arctan u\big]_{0}^{1}=\frac13\cdot\frac{\pi}{4}=\boxed{\dfrac{\pi}{12}}. \]`,
        solution_hy: r`<p>Դիցուք \(u=x^{3}\), \(du=3x^{2}\,dx\)։ Սահմանները \(0,1\) արտապատկերվում են \(0,1\)-ի.</p>
\[ \int_{0}^{1}\frac{x^{2}}{1+x^{6}}\,dx=\frac13\int_{0}^{1}\frac{du}{1+u^{2}}=\frac13\big[\arctan u\big]_{0}^{1}=\frac13\cdot\frac{\pi}{4}=\boxed{\dfrac{\pi}{12}}. \]`,
      },
      {
        type: "problem",
        title: "Taylor series of cos²x",
        title_hy: "cos²x-ի Թեյլորի շարք",
        source: "HW 6 · Problem 4a",
        prompt: "Linearize the square first: cos²x = (1 + cos 2x)/2.",
        prompt_hy: "Նախ գծայնացրո՛ւ քառակուսին. cos²x = (1 + cos 2x)/2։",
        statement: r`<p>Find the Taylor series of \( f(x)=\cos^{2}x \) at \(x_{0}=0\).</p>`,
        statement_hy: r`<p>Գտի՛ր \( f(x)=\cos^{2}x \)-ի Թեյլորի շարքը \(x_{0}=0\)-ում։</p>`,
        solution: r`<p>Use \(\cos^{2}x=\dfrac{1+\cos 2x}{2}\) and \(\cos 2x=\sum_{n\ge 0}\dfrac{(-1)^{n}(2x)^{2n}}{(2n)!}\):</p>
\[ \cos^{2}x=1+\frac12\sum_{n\ge 1}\frac{(-1)^{n}2^{2n}}{(2n)!}\,x^{2n}=1-x^{2}+\frac{x^{4}}{3}-\frac{2x^{6}}{45}+\cdots \]`,
        solution_hy: r`<p>Օգտագործի՛ր \(\cos^{2}x=\dfrac{1+\cos 2x}{2}\) և \(\cos 2x=\sum_{n\ge 0}\dfrac{(-1)^{n}(2x)^{2n}}{(2n)!}\).</p>
\[ \cos^{2}x=1+\frac12\sum_{n\ge 1}\frac{(-1)^{n}2^{2n}}{(2n)!}\,x^{2n}=1-x^{2}+\frac{x^{4}}{3}-\frac{2x^{6}}{45}+\cdots \]`,
      },
    ],

    "math-2-5": [
      {
        type: "problem",
        title: "A convergent improper integral",
        title_hy: "Զուգամիտող անճիշտ ինտեգրալ",
        source: "HW 6 · Problem 2c",
        prompt: "Partial fractions, then the log telescopes at infinity.",
        prompt_hy: "Պարզ կոտորակներ, հետո լոգարիթմը հեռանում է անվերջությունում։",
        statement: r`<p>Evaluate \[ \int_{2}^{+\infty}\frac{dx}{x^{2}+x-2}. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \int_{2}^{+\infty}\frac{dx}{x^{2}+x-2}. \]</p>`,
        solution: r`<p>Factor \(x^{2}+x-2=(x+2)(x-1)\) and split:</p>
\[ \frac{1}{(x+2)(x-1)}=\frac13\left(\frac{1}{x-1}-\frac{1}{x+2}\right). \]
\[ \int_{2}^{\infty}=\frac13\left[\ln\frac{x-1}{x+2}\right]_{2}^{\infty}=\frac13\left(\ln 1-\ln\tfrac14\right)=\boxed{\dfrac{\ln 4}{3}}\approx 0.462. \]
<p>The integral converges (the integrand decays like \(x^{-2}\)).</p>`,
        solution_hy: r`<p>Վերլուծի՛ր \(x^{2}+x-2=(x+2)(x-1)\) և բաժանի՛ր.</p>
\[ \frac{1}{(x+2)(x-1)}=\frac13\left(\frac{1}{x-1}-\frac{1}{x+2}\right). \]
\[ \int_{2}^{\infty}=\frac13\left[\ln\frac{x-1}{x+2}\right]_{2}^{\infty}=\frac13\left(\ln 1-\ln\tfrac14\right)=\boxed{\dfrac{\ln 4}{3}}\approx 0.462. \]
<p>Ինտեգրալը զուգամիտում է (ֆունկցիան մարում է \(x^{-2}\)-ի պես)։</p>`,
      },
      {
        type: "problem",
        title: "Series convergence by the ratio test",
        title_hy: "Շարքի զուգամիտումը հարաբերության թեստով",
        source: "HW 5 · Problem 9d",
        prompt: "Form aₙ₊₁/aₙ and take the limit.",
        prompt_hy: "Կազմի՛ր aₙ₊₁/aₙ և վերցրո՛ւ սահմանը։",
        statement: r`<p>Investigate the convergence of \[ \sum_{n=1}^{\infty}\frac{(3n)!}{(n!)^{3}\,4^{3n}}. \]</p>`,
        statement_hy: r`<p>Հետազոտի՛ր \[ \sum_{n=1}^{\infty}\frac{(3n)!}{(n!)^{3}\,4^{3n}} \] շարքի զուգամիտությունը։</p>`,
        solution: r`<p>Apply the ratio test:</p>
\[ \frac{a_{n+1}}{a_{n}}=\frac{(3n+3)(3n+2)(3n+1)}{(n+1)^{3}\cdot 4^{3}}\;\xrightarrow[n\to\infty]{}\;\frac{27}{64}<1. \]
<p>Since the limiting ratio is \(\tfrac{27}{64}<1\), the series <strong>converges</strong>.</p>`,
        solution_hy: r`<p>Կիրառի՛ր հարաբերության թեստը.</p>
\[ \frac{a_{n+1}}{a_{n}}=\frac{(3n+3)(3n+2)(3n+1)}{(n+1)^{3}\cdot 4^{3}}\;\xrightarrow[n\to\infty]{}\;\frac{27}{64}<1. \]
<p>Քանի որ սահմանային հարաբերությունը \(\tfrac{27}{64}<1\) է, շարքը <strong>զուգամիտում է</strong>։</p>`,
      },
    ],

    "math-2-6": [
      {
        type: "problem",
        title: "Gradient of a 2-variable function",
        title_hy: "Երկու փոփոխականի ֆունկցիայի գրադիենտ",
        source: "HW 6 · Problem 5a",
        prompt: "Product rule in x; treat y as constant for ∂/∂x and vice versa.",
        prompt_hy: "Արտադրյալի կանոն x-ով. ∂/∂x-ի համար y-ը հաստատուն է և հակառակը։",
        statement: r`<p>Compute the gradient of \( f(x,y)=x\sin(x+y) \), and evaluate it at \(\left(\tfrac{\pi}{2},0\right)\).</p>`,
        statement_hy: r`<p>Հաշվի՛ր \( f(x,y)=x\sin(x+y) \)-ի գրադիենտը և հաշվի՛ր այն \(\left(\tfrac{\pi}{2},0\right)\)-ում։</p>`,
        solution: r`<p>Differentiate:</p>
\[ \nabla f=\Big(\sin(x+y)+x\cos(x+y),\;\; x\cos(x+y)\Big). \]
<p>At \(\left(\tfrac{\pi}{2},0\right)\), \(\sin\tfrac{\pi}{2}=1\) and \(\cos\tfrac{\pi}{2}=0\), so</p>
\[ \nabla f\!\left(\tfrac{\pi}{2},0\right)=\big(1+0,\;0\big)=\boxed{(1,\,0)}. \]`,
        solution_hy: r`<p>Ածանցի՛ր.</p>
\[ \nabla f=\Big(\sin(x+y)+x\cos(x+y),\;\; x\cos(x+y)\Big). \]
<p>\(\left(\tfrac{\pi}{2},0\right)\)-ում \(\sin\tfrac{\pi}{2}=1\) և \(\cos\tfrac{\pi}{2}=0\), ուստի</p>
\[ \nabla f\!\left(\tfrac{\pi}{2},0\right)=\big(1+0,\;0\big)=\boxed{(1,\,0)}. \]`,
      },
      {
        type: "problem",
        title: "A limit of two variables",
        title_hy: "Երկու փոփոխականի սահման",
        source: "HW 7 · Problem 1a",
        prompt: "Multiply and divide by y to recover the sin t / t limit.",
        prompt_hy: "Բազմապատկի՛ր և բաժանի՛ր y-ով՝ sin t / t սահմանը վերականգնելու համար։",
        statement: r`<p>Compute \[ \lim_{(x,y)\to(0,1)}\frac{\sin(xy)}{x}. \]</p>`,
        statement_hy: r`<p>Հաշվի՛ր \[ \lim_{(x,y)\to(0,1)}\frac{\sin(xy)}{x}. \]</p>`,
        solution: r`<p>Write \(\dfrac{\sin(xy)}{x}=y\cdot\dfrac{\sin(xy)}{xy}\). As \((x,y)\to(0,1)\) the product \(xy\to 0\), so \(\dfrac{\sin(xy)}{xy}\to 1\), and \(y\to 1\):</p>
\[ \lim_{(x,y)\to(0,1)}\frac{\sin(xy)}{x}=1\cdot 1=\boxed{1}. \]`,
        solution_hy: r`<p>Գրի՛ր \(\dfrac{\sin(xy)}{x}=y\cdot\dfrac{\sin(xy)}{xy}\)։ Երբ \((x,y)\to(0,1)\), արտադրյալը \(xy\to 0\), ուստի \(\dfrac{\sin(xy)}{xy}\to 1\), և \(y\to 1\).</p>
\[ \lim_{(x,y)\to(0,1)}\frac{\sin(xy)}{x}=1\cdot 1=\boxed{1}. \]`,
      },
    ],

    "math-2-7": [
      {
        type: "problem",
        title: "Critical point of a paraboloid",
        title_hy: "Պարաբոլոիդի կրիտիկական կետ",
        source: "HW 7 · Problem 3a",
        prompt: "Set the gradient to zero; the Hessian's definiteness classifies it.",
        prompt_hy: "Գրադիենտը զրոյացրո՛ւ. Հեսյանի որոշյալությունը դասակարգում է կետը։",
        statement: r`<p>Find the local extrema and saddle points of \( f(x,y)=x^{2}+(y-1)^{2}. \)</p>`,
        statement_hy: r`<p>Գտի՛ր \( f(x,y)=x^{2}+(y-1)^{2} \)-ի լոկալ էքստրեմումներն ու թամբի կետերը։</p>`,
        solution: r`<p>\( \nabla f=(2x,\,2(y-1))=\mathbf{0} \) gives the single critical point \((0,1)\). The Hessian is</p>
\[ H=\begin{bmatrix}2&0\\0&2\end{bmatrix}, \]
<p>positive definite everywhere, so \((0,1)\) is a strict (global) minimum with \(f(0,1)=\boxed{0}\). There are no saddle points.</p>`,
        solution_hy: r`<p>\( \nabla f=(2x,\,2(y-1))=\mathbf{0} \) տալիս է միակ կրիտիկական կետը՝ \((0,1)\)։ Հեսյանն է</p>
\[ H=\begin{bmatrix}2&0\\0&2\end{bmatrix}, \]
<p>ամենուր դրական որոշյալ, ուստի \((0,1)\)-ը խիստ (գլոբալ) մինիմում է՝ \(f(0,1)=\boxed{0}\)։ Թամբի կետեր չկան։</p>`,
      },
      {
        type: "problem",
        title: "Directional derivative",
        title_hy: "Ուղղորդված ածանցյալ",
        source: "HW 7 · Problem 2",
        prompt: "D_v f = ∇f · v with v a unit vector at 60° from the x-axis.",
        prompt_hy: "D_v f = ∇f · v, որտեղ v-ն x-առանցքից 60°-ի միավոր վեկտոր է։",
        statement: r`<p>For \( f(x,y)=x^{2}-y^{2} \), find the directional derivative at \((1,1)\) along the unit vector \(v\) that makes a \(60^{\circ}\) angle with the \(Ox\) axis.</p>`,
        statement_hy: r`<p>\( f(x,y)=x^{2}-y^{2} \)-ի համար գտի՛ր ուղղորդված ածանցյալը \((1,1)\)-ում այն \(v\) միավոր վեկտորի ուղղությամբ, որը \(Ox\) առանցքի հետ կազմում է \(60^{\circ}\) անկյուն։</p>`,
        solution: r`<p>\( \nabla f=(2x,-2y)=(2,-2) \) at \((1,1)\), and \(v=(\cos 60^{\circ},\sin 60^{\circ})=\left(\tfrac12,\tfrac{\sqrt3}{2}\right)\). Then</p>
\[ D_{v}f=\nabla f\cdot v=2\cdot\tfrac12+(-2)\cdot\tfrac{\sqrt3}{2}=\boxed{\,1-\sqrt3\,}\approx-0.732. \]`,
        solution_hy: r`<p>\((1,1)\)-ում \( \nabla f=(2x,-2y)=(2,-2) \), և \(v=(\cos 60^{\circ},\sin 60^{\circ})=\left(\tfrac12,\tfrac{\sqrt3}{2}\right)\)։ Այդ դեպքում</p>
\[ D_{v}f=\nabla f\cdot v=2\cdot\tfrac12+(-2)\cdot\tfrac{\sqrt3}{2}=\boxed{\,1-\sqrt3\,}\approx-0.732. \]`,
      },
    ],

    /* ============ Module 3 · Probability & Statistics ============ */

    "math-3-1": [
      {
        type: "problem",
        title: "Conditional probability with dice",
        title_hy: "Պայմանական հավանականություն զառերով",
        source: "HW 7 · Problem 4",
        prompt: "Restrict the sample space to the 30 outcomes with different numbers.",
        prompt_hy: "Սահմանափակի՛ր տարածությունը տարբեր թվերով 30 ելքերով։",
        statement: r`<p>Two fair dice are rolled. What is the probability that at least one lands on \(6\), given that the dice land on different numbers?</p>`,
        statement_hy: r`<p>Երկու ազնիվ զառ նետվում է։ Ո՞րն է հավանականությունը, որ առնվազն մեկը 6 է ընկնում, պայմանով, որ զառերը տարբեր թվեր են ցույց տալիս։</p>`,
        solution: r`<p>Condition on "different numbers": there are \(6\cdot 5=30\) equally likely such outcomes. Those containing a \(6\) are \((6,k)\) and \((k,6)\) for \(k=1,\dots,5\) — \(10\) outcomes. Hence</p>
\[ P(\text{a } 6\mid\text{different})=\frac{10}{30}=\boxed{\tfrac13}. \]`,
        solution_hy: r`<p>Պայմանավորի՛ր «տարբեր թվերով». կան \(6\cdot 5=30\) հավասարահավանական այդպիսի ելք։ \(6\) պարունակողներն են \((6,k)\) և \((k,6)\)՝ \(k=1,\dots,5\), այսինքն \(10\) ելք։ Հետևաբար</p>
\[ P(\text{6}\mid\text{տարբեր})=\frac{10}{30}=\boxed{\tfrac13}. \]`,
      },
      {
        type: "problem",
        title: "Bayes' rule: who caused the failure?",
        title_hy: "Բայեսի կանոն. ո՞վ է պատճառը",
        source: "HW 8 · Problem 4",
        prompt: "Posterior ∝ prior × likelihood; normalize by the total failure probability.",
        prompt_hy: "Հետին ∝ նախնական × հավանելիություն. նորմավորի՛ր ընդհանուր ձախողման հավանականությամբ։",
        statement: r`<p>Cooks A, B, C bake \(50\%\), \(30\%\), \(20\%\) of the cakes, and their cakes fail to rise with probabilities \(0.02\), \(0.03\), \(0.05\). Given a failed cake, what proportion is A's?</p>`,
        statement_hy: r`<p>Խոհարարներ A, B, C թխում են տորթերի \(50\%\), \(30\%\), \(20\%\)-ը, և նրանց տորթերը չեն բարձրանում \(0.02\), \(0.03\), \(0.05\) հավանականություններով։ Ձախողված տորթի դեպքում ի՞նչ մասն է A-ինը։</p>`,
        solution: r`<p>Total failure probability:</p>
\[ P(F)=0.5(0.02)+0.3(0.03)+0.2(0.05)=0.01+0.009+0.01=0.029. \]
<p>By Bayes' rule,</p>
\[ P(A\mid F)=\frac{0.5(0.02)}{0.029}=\frac{0.01}{0.029}=\boxed{\tfrac{10}{29}}\approx 0.345. \]`,
        solution_hy: r`<p>Ընդհանուր ձախողման հավանականությունը.</p>
\[ P(F)=0.5(0.02)+0.3(0.03)+0.2(0.05)=0.01+0.009+0.01=0.029. \]
<p>Բայեսի կանոնով՝</p>
\[ P(A\mid F)=\frac{0.5(0.02)}{0.029}=\frac{0.01}{0.029}=\boxed{\tfrac{10}{29}}\approx 0.345. \]`,
      },
    ],

    "math-3-2": [
      {
        type: "problem",
        title: "Expected value & variance of a symmetric RV",
        title_hy: "Սիմետրիկ պ.մ.-ի սպասում և դիսպերսիա",
        source: "HW 9 · Problem 3",
        prompt: "Symmetry kills the mean; use Σi² = n(n+1)(2n+1)/6 for the variance.",
        prompt_hy: "Սիմետրիան զրոյացնում է միջինը. դիսպերսիայի համար օգտագործի՛ր Σi² = n(n+1)(2n+1)/6։",
        statement: r`<p>The random variable \(X\) takes each value in \(\{0,\pm 1,\pm 2,\dots,\pm n\}\) with probability \(\dfrac{1}{2n+1}\). Compute \(E[X]\) and \(\operatorname{Var}(X)\).</p>`,
        statement_hy: r`<p>\(X\) պատահական մեծությունը \(\{0,\pm 1,\pm 2,\dots,\pm n\}\)-ի ամեն արժեք ընդունում է \(\dfrac{1}{2n+1}\) հավանականությամբ։ Հաշվի՛ր \(E[X]\)-ը և \(\operatorname{Var}(X)\)-ը։</p>`,
        solution: r`<p>The distribution is symmetric about \(0\), so \(E[X]=0\). Then \(\operatorname{Var}(X)=E[X^{2}]\):</p>
\[ E[X^{2}]=\frac{1}{2n+1}\cdot 2\sum_{i=1}^{n}i^{2}=\frac{2}{2n+1}\cdot\frac{n(n+1)(2n+1)}{6}=\boxed{\dfrac{n(n+1)}{3}}. \]`,
        solution_hy: r`<p>Բաշխումը սիմետրիկ է \(0\)-ի նկատմամբ, ուստի \(E[X]=0\)։ Այդ դեպքում \(\operatorname{Var}(X)=E[X^{2}]\).</p>
\[ E[X^{2}]=\frac{1}{2n+1}\cdot 2\sum_{i=1}^{n}i^{2}=\frac{2}{2n+1}\cdot\frac{n(n+1)(2n+1)}{6}=\boxed{\dfrac{n(n+1)}{3}}. \]`,
      },
      {
        type: "problem",
        title: "Number of boys in a family",
        title_hy: "Տղաների թիվը ընտանիքում",
        source: "HW 8 · Problem 7",
        prompt: "X is Binomial(4, ½); read the PMF, mean and variance straight off.",
        prompt_hy: "X-ը Binomial(4, ½) է. PMF-ը, միջինն ու դիսպերսիան ուղիղ կարդա՛։",
        statement: r`<p>A couple has \(4\) children, each independently a boy or girl with probability \(\tfrac12\). Let \(X\) be the number of boys. Give the PMF, \(E[X]\) and \(\operatorname{Var}(X)\).</p>`,
        statement_hy: r`<p>Զույգն ունի \(4\) երեխա, ամեն մեկն անկախորեն տղա կամ աղջիկ է \(\tfrac12\) հավանականությամբ։ Դիցուք \(X\)-ը տղաների թիվն է։ Տո՛ւր PMF-ը, \(E[X]\)-ն ու \(\operatorname{Var}(X)\)-ը։</p>`,
        solution: r`<p>\(X\sim\text{Binomial}(4,\tfrac12)\), so \(P(X=k)=\dbinom{4}{k}\big/16\):</p>
\[ P=\left(\tfrac{1}{16},\tfrac{4}{16},\tfrac{6}{16},\tfrac{4}{16},\tfrac{1}{16}\right)\ \text{for } k=0,1,2,3,4. \]
\[ E[X]=np=2,\qquad \operatorname{Var}(X)=np(1-p)=1. \]`,
        solution_hy: r`<p>\(X\sim\text{Binomial}(4,\tfrac12)\), ուստի \(P(X=k)=\dbinom{4}{k}\big/16\).</p>
\[ P=\left(\tfrac{1}{16},\tfrac{4}{16},\tfrac{6}{16},\tfrac{4}{16},\tfrac{1}{16}\right)\ \text{երբ } k=0,1,2,3,4. \]
\[ E[X]=np=2,\qquad \operatorname{Var}(X)=np(1-p)=1. \]`,
      },
    ],

    "math-3-3": [
      {
        type: "problem",
        title: "Correlation of X and X²",
        title_hy: "X և X²-ի կորելացիա",
        source: "HW 10 · Problem 2a",
        prompt: "For X ~ U(0,1), E[Xᵏ] = 1/(k+1). Assemble covariance and both variances.",
        prompt_hy: "X ~ U(0,1)-ի համար E[Xᵏ] = 1/(k+1)։ Հավաքի՛ր կովարիացիան և երկու դիսպերսիաները։",
        statement: r`<p>Let \(X\sim U(0,1)\). Find the correlation of \(X\) and \(X^{2}\).</p>`,
        statement_hy: r`<p>Դիցուք \(X\sim U(0,1)\)։ Գտի՛ր \(X\)-ի և \(X^{2}\)-ի կորելացիան։</p>`,
        solution: r`<p>Since \(E[X^{k}]=\tfrac{1}{k+1}\):</p>
\[ \operatorname{Cov}(X,X^{2})=E[X^{3}]-E[X]E[X^{2}]=\tfrac14-\tfrac12\cdot\tfrac13=\tfrac{1}{12}, \]
\[ \operatorname{Var}(X)=\tfrac13-\tfrac14=\tfrac{1}{12},\qquad \operatorname{Var}(X^{2})=\tfrac15-\tfrac19=\tfrac{4}{45}. \]
\[ \rho=\frac{1/12}{\sqrt{\tfrac{1}{12}\cdot\tfrac{4}{45}}}=\boxed{\dfrac{\sqrt{15}}{4}}\approx 0.968. \]`,
        solution_hy: r`<p>Քանի որ \(E[X^{k}]=\tfrac{1}{k+1}\).</p>
\[ \operatorname{Cov}(X,X^{2})=E[X^{3}]-E[X]E[X^{2}]=\tfrac14-\tfrac12\cdot\tfrac13=\tfrac{1}{12}, \]
\[ \operatorname{Var}(X)=\tfrac13-\tfrac14=\tfrac{1}{12},\qquad \operatorname{Var}(X^{2})=\tfrac15-\tfrac19=\tfrac{4}{45}. \]
\[ \rho=\frac{1/12}{\sqrt{\tfrac{1}{12}\cdot\tfrac{4}{45}}}=\boxed{\dfrac{\sqrt{15}}{4}}\approx 0.968. \]`,
      },
      {
        type: "problem",
        title: "Normalize a joint density",
        title_hy: "Նորմավորի՛ր համատեղ խտությունը",
        source: "HW 10 · Problem 8a",
        prompt: "The double integral over the rectangle must equal 1.",
        prompt_hy: "Ուղղանկյան վրայով կրկնակի ինտեգրալը պետք է հավասար լինի 1-ի։",
        statement: r`<p>The joint density is \( f(x,y)=a\left(x^{2}+\tfrac{xy}{2}\right) \) on \([0,1]\times[0,2]\) (and \(0\) elsewhere). Find \(a\).</p>`,
        statement_hy: r`<p>Համատեղ խտությունն է \( f(x,y)=a\left(x^{2}+\tfrac{xy}{2}\right) \)՝ \([0,1]\times[0,2]\)-ի վրա (և \(0\)՝ մնացած տեղերում)։ Գտի՛ր \(a\)-ն։</p>`,
        solution: r`<p>Require \(\displaystyle\int_{0}^{1}\!\int_{0}^{2} a\left(x^{2}+\tfrac{xy}{2}\right)dy\,dx=1\). The inner integral:</p>
\[ \int_{0}^{2}\left(x^{2}+\tfrac{xy}{2}\right)dy=2x^{2}+x. \]
\[ \int_{0}^{1}(2x^{2}+x)\,dx=\tfrac23+\tfrac12=\tfrac{7}{6}\;\Rightarrow\; a\cdot\tfrac76=1\;\Rightarrow\;\boxed{a=\tfrac{6}{7}}. \]`,
        solution_hy: r`<p>Պահանջվում է \(\displaystyle\int_{0}^{1}\!\int_{0}^{2} a\left(x^{2}+\tfrac{xy}{2}\right)dy\,dx=1\)։ Ներքին ինտեգրալը.</p>
\[ \int_{0}^{2}\left(x^{2}+\tfrac{xy}{2}\right)dy=2x^{2}+x. \]
\[ \int_{0}^{1}(2x^{2}+x)\,dx=\tfrac23+\tfrac12=\tfrac{7}{6}\;\Rightarrow\; a\cdot\tfrac76=1\;\Rightarrow\;\boxed{a=\tfrac{6}{7}}. \]`,
      },
    ],

    "math-3-4": [
      {
        type: "problem",
        title: "In probability, but not in mean",
        title_hy: "Ըստ հավանականության, բայց ոչ ըստ միջինի",
        source: "HW 10 · Problem 5",
        prompt: "Compare P(|Xₙ| > ε) with E[Xₙ].",
        prompt_hy: "Համեմատի՛ր P(|Xₙ| > ε)-ն E[Xₙ]-ի հետ։",
        statement: r`<p>Let \( X_{n}=n^{2} \) with probability \(\tfrac1n\), and \(0\) with probability \(1-\tfrac1n\). Does \(X_{n}\to 0\) in probability? In the \(L^{1}\) (mean) sense?</p>`,
        statement_hy: r`<p>Դիցուք \( X_{n}=n^{2} \)՝ \(\tfrac1n\) հավանականությամբ, և \(0\)՝ \(1-\tfrac1n\) հավանականությամբ։ Արդյո՞ք \(X_{n}\to 0\) ըստ հավանականության։ Ըստ \(L^{1}\) (միջինի) իմաստի՞։</p>`,
        solution: r`<p>For any \(\varepsilon>0\), \(P(|X_{n}|>\varepsilon)=P(X_{n}=n^{2})=\tfrac1n\to 0\), so \(X_{n}\xrightarrow{P}0\). But</p>
\[ E[X_{n}]=n^{2}\cdot\tfrac1n=n\to\infty, \]
<p>so \(X_{n}\) does <strong>not</strong> converge in mean. A classic reminder: convergence in probability does not imply convergence in \(L^{1}\).</p>`,
        solution_hy: r`<p>Ցանկացած \(\varepsilon>0\)-ի համար \(P(|X_{n}|>\varepsilon)=P(X_{n}=n^{2})=\tfrac1n\to 0\), ուստի \(X_{n}\xrightarrow{P}0\)։ Բայց</p>
\[ E[X_{n}]=n^{2}\cdot\tfrac1n=n\to\infty, \]
<p>ուստի \(X_{n}\)-ը <strong>չի</strong> զուգամիտում ըստ միջինի։ Դասական հիշեցում. ըստ հավանականության զուգամիտումը չի ենթադրում \(L^{1}\) զուգամիտում։</p>`,
      },
      {
        type: "problem",
        title: "Binomial → Poisson",
        title_hy: "Բինոմիալ → Պուասոն",
        source: "HW 10 · Problem 4",
        prompt: "Split the binomial PMF into three factors and take each limit.",
        prompt_hy: "Բինոմիալ PMF-ը բաժանի՛ր երեք արտադրիչի և ամեն մեկի սահմանը վերցրո՛ւ։",
        statement: r`<p>Let \( X_{n}\sim\text{Binomial}\!\left(n,\tfrac{\lambda}{n}\right) \). Show that \(X_{n}\) converges in distribution to \(\text{Poisson}(\lambda)\).</p>`,
        statement_hy: r`<p>Դիցուք \( X_{n}\sim\text{Binomial}\!\left(n,\tfrac{\lambda}{n}\right) \)։ Ցո՛ւյց տուր, որ \(X_{n}\)-ը ըստ բաշխման զուգամիտում է \(\text{Poisson}(\lambda)\)-ի։</p>`,
        solution: r`<p>Fix \(k\). Then</p>
\[ P(X_{n}=k)=\binom{n}{k}\left(\frac{\lambda}{n}\right)^{k}\left(1-\frac{\lambda}{n}\right)^{n-k}=\underbrace{\frac{n!}{k!\,(n-k)!\,n^{k}}}_{\to\,1/k!}\,\lambda^{k}\underbrace{\left(1-\tfrac{\lambda}{n}\right)^{n}}_{\to\,e^{-\lambda}}\underbrace{\left(1-\tfrac{\lambda}{n}\right)^{-k}}_{\to\,1}. \]
\[ \Longrightarrow\; P(X_{n}=k)\to\frac{e^{-\lambda}\lambda^{k}}{k!}, \]
<p>the Poisson\((\lambda)\) PMF (the "law of rare events").</p>`,
        solution_hy: r`<p>Ֆիքսի՛ր \(k\)։ Այդ դեպքում</p>
\[ P(X_{n}=k)=\binom{n}{k}\left(\frac{\lambda}{n}\right)^{k}\left(1-\frac{\lambda}{n}\right)^{n-k}=\underbrace{\frac{n!}{k!\,(n-k)!\,n^{k}}}_{\to\,1/k!}\,\lambda^{k}\underbrace{\left(1-\tfrac{\lambda}{n}\right)^{n}}_{\to\,e^{-\lambda}}\underbrace{\left(1-\tfrac{\lambda}{n}\right)^{-k}}_{\to\,1}. \]
\[ \Longrightarrow\; P(X_{n}=k)\to\frac{e^{-\lambda}\lambda^{k}}{k!}, \]
<p>Պուասոն\((\lambda)\) PMF-ը («հազվագյուտ դեպքերի օրենքը»)։</p>`,
      },
    ],

    "math-3-5": [
      {
        type: "problem",
        title: "Poisson approximation (rare events)",
        title_hy: "Պուասոնյան մոտարկում (հազվագյուտ դեպքեր)",
        source: "HW 9 · Problem 1",
        prompt: "Many trials, tiny p → Poisson with λ = np = 0.5.",
        prompt_hy: "Շատ փորձ, փոքրիկ p → Պուասոն λ = np = 0.5-ով։",
        statement: r`<p>You play \(50\) independent lotteries, each with win probability \(\tfrac{1}{100}\). Approximate the probability of winning (a) at least once, (b) exactly once, (c) at least twice.</p>`,
        statement_hy: r`<p>Դու խաղում ես \(50\) անկախ վիճակախաղ, ամեն մեկը հաղթելու \(\tfrac{1}{100}\) հավանականությամբ։ Մոտավոր հաշվի՛ր հաղթելու հավանականությունը (ա) առնվազն մեկ անգամ, (բ) ճիշտ մեկ անգամ, (գ) առնվազն երկու անգամ։</p>`,
        solution: r`<p>Large \(n\), small \(p\Rightarrow\) Poisson with \(\lambda=np=0.5\).</p>
\[ P(\ge 1)=1-e^{-0.5}\approx 0.393,\qquad P(=1)=0.5\,e^{-0.5}\approx 0.303, \]
\[ P(\ge 2)=1-e^{-0.5}-0.5\,e^{-0.5}\approx 0.090. \]
<p>(Exact binomial values: \(0.395\), \(0.306\), \(0.089\) — the approximation is excellent.)</p>`,
        solution_hy: r`<p>Մեծ \(n\), փոքր \(p\Rightarrow\) Պուասոն \(\lambda=np=0.5\)-ով։</p>
\[ P(\ge 1)=1-e^{-0.5}\approx 0.393,\qquad P(=1)=0.5\,e^{-0.5}\approx 0.303, \]
\[ P(\ge 2)=1-e^{-0.5}-0.5\,e^{-0.5}\approx 0.090. \]
<p>(Ճշգրիտ բինոմիալ արժեքները՝ \(0.395\), \(0.306\), \(0.089\) — մոտարկումը հիանալի է։)</p>`,
      },
      {
        type: "problem",
        title: "Poisson counts",
        title_hy: "Պուասոնյան հաշվարկներ",
        source: "HW 9 · Problem 2",
        prompt: "Use the Poisson PMF with mean 3.5; complement for 'at least 2'.",
        prompt_hy: "Օգտագործի՛ր Պուասոն PMF-ը 3.5 միջինով. «առնվազն 2»-ի համար՝ լրացույց։",
        statement: r`<p>The monthly worldwide number of commercial airplane crashes is Poisson with mean \(3.5\). Find the probability of (a) at least \(2\) crashes next month, (b) at most \(1\).</p>`,
        statement_hy: r`<p>Ամսական համաշխարհային ավիավթարների թիվը Պուասոն է \(3.5\) միջինով։ Գտի՛ր հավանականությունը, որ հաջորդ ամիս կլինի (ա) առնվազն \(2\) վթար, (բ) առավելագույնը \(1\)։</p>`,
        solution: r`<p>With \(\lambda=3.5\), \(P(X=k)=e^{-\lambda}\lambda^{k}/k!\). The "at most 1" case:</p>
\[ P(X\le 1)=e^{-3.5}(1+3.5)=4.5\,e^{-3.5}\approx 0.136, \]
\[ P(X\ge 2)=1-P(X\le 1)\approx 0.864. \]`,
        solution_hy: r`<p>\(\lambda=3.5\)-ով \(P(X=k)=e^{-\lambda}\lambda^{k}/k!\)։ «Առավելագույնը 1» դեպքը.</p>
\[ P(X\le 1)=e^{-3.5}(1+3.5)=4.5\,e^{-3.5}\approx 0.136, \]
\[ P(X\ge 2)=1-P(X\le 1)\approx 0.864. \]`,
      },
    ],

    /* ============ Module 4 · Signals & Fourier ============ */

    "math-4-1": [
      {
        type: "problem",
        title: "Fourier transform of a decaying exponential",
        title_hy: "Մարող էքսպոնենտի Ֆուրիեի ձևափոխություն",
        source: "HW 11 · Problem 1b",
        prompt: "Integrate e^{-(1+iω)t} from 0 to ∞.",
        prompt_hy: "Ինտեգրի՛ր e^{-(1+iω)t} 0-ից ∞։",
        statement: r`<p>Find the Fourier transform \( \hat f(\omega)=\int_{-\infty}^{\infty} f(t)e^{-i\omega t}\,dt \) of
\[ f(t)=\begin{cases}0, & t<0,\\ e^{-t}, & t\ge 0.\end{cases} \]</p>`,
        statement_hy: r`<p>Գտի՛ր \( \hat f(\omega)=\int_{-\infty}^{\infty} f(t)e^{-i\omega t}\,dt \) Ֆուրիեի ձևափոխությունը
\[ f(t)=\begin{cases}0, & t<0,\\ e^{-t}, & t\ge 0.\end{cases} \]</p>`,
        solution: r`<p>Only \(t\ge 0\) contributes:</p>
\[ \hat f(\omega)=\int_{0}^{\infty} e^{-t}e^{-i\omega t}\,dt=\int_{0}^{\infty} e^{-(1+i\omega)t}\,dt=\left[\frac{-e^{-(1+i\omega)t}}{1+i\omega}\right]_{0}^{\infty}=\boxed{\dfrac{1}{1+i\omega}}. \]
<p>The magnitude spectrum is \(|\hat f(\omega)|=\dfrac{1}{\sqrt{1+\omega^{2}}}\).</p>`,
        solution_hy: r`<p>Ներդրում ունի միայն \(t\ge 0\)-ն.</p>
\[ \hat f(\omega)=\int_{0}^{\infty} e^{-t}e^{-i\omega t}\,dt=\int_{0}^{\infty} e^{-(1+i\omega)t}\,dt=\left[\frac{-e^{-(1+i\omega)t}}{1+i\omega}\right]_{0}^{\infty}=\boxed{\dfrac{1}{1+i\omega}}. \]
<p>Ամպլիտուդային սպեկտրն է \(|\hat f(\omega)|=\dfrac{1}{\sqrt{1+\omega^{2}}}\)։</p>`,
      },
      {
        type: "problem",
        title: "Fourier transform of a rectangular pulse",
        title_hy: "Ուղղանկյուն իմպուլսի Ֆուրիեի ձևափոխություն",
        source: "HW 11 · Problem 1a",
        prompt: "Integrate e^{-iωt} over [−½, ½] and simplify with Euler's formula.",
        prompt_hy: "Ինտեգրի՛ր e^{-iωt} [−½, ½]-ի վրա և պարզեցրո՛ւ Էյլերի բանաձևով։",
        statement: r`<p>Find the Fourier transform of the rectangular pulse \( f(t)=1 \) for \(|t|<\tfrac12\) (with \(f=\tfrac12\) at \(|t|=\tfrac12\), \(0\) outside).</p>`,
        statement_hy: r`<p>Գտի՛ր ուղղանկյուն իմպուլսի Ֆուրիեի ձևափոխությունը. \( f(t)=1 \) երբ \(|t|<\tfrac12\) (և \(f=\tfrac12\) երբ \(|t|=\tfrac12\), \(0\)՝ դրսում)։</p>`,
        solution: r`<p>Integrate over the support:</p>
\[ \hat f(\omega)=\int_{-1/2}^{1/2}e^{-i\omega t}\,dt=\frac{e^{i\omega/2}-e^{-i\omega/2}}{i\omega}=\boxed{\dfrac{2\sin(\omega/2)}{\omega}}, \]
<p>with \(\hat f(0)=1\) by continuity. (This is the \(\operatorname{sinc}\) that underlies the sampling theorem.)</p>`,
        solution_hy: r`<p>Ինտեգրի՛ր կրիչի վրա.</p>
\[ \hat f(\omega)=\int_{-1/2}^{1/2}e^{-i\omega t}\,dt=\frac{e^{i\omega/2}-e^{-i\omega/2}}{i\omega}=\boxed{\dfrac{2\sin(\omega/2)}{\omega}}, \]
<p>որտեղ \(\hat f(0)=1\)՝ անընդհատությամբ։ (Սա \(\operatorname{sinc}\)-ն է, որ ընկած է դիսկրետացման թեորեմի հիմքում։)</p>`,
      },
    ],

    "math-4-2": [
      {
        type: "problem",
        title: "Fourier series of x² and the Basel sum",
        title_hy: "x²-ի Ֆուրիեի շարքը և Բազելի գումարը",
        source: "HW 11 · Problem 2",
        prompt: "f is even → cosines only. Evaluate at x = π to get Σ1/n².",
        prompt_hy: "f-ը զույգ է → միայն կոսինուսներ։ Հաշվի՛ր x = π-ում՝ Σ1/n² ստանալու համար։",
        statement: r`<p>For \( f(x)=x^{2} \) on \([-\pi,\pi]\), find the Fourier series and deduce \(\displaystyle\sum_{n=1}^{\infty}\frac{1}{n^{2}}\).</p>`,
        statement_hy: r`<p>\( f(x)=x^{2} \)-ի համար \([-\pi,\pi]\)-ի վրա գտի՛ր Ֆուրիեի շարքը և հանի՛ր \(\displaystyle\sum_{n=1}^{\infty}\frac{1}{n^{2}}\)-ը։</p>`,
        solution: r`<p>\(f\) is even, so only cosine terms appear. The coefficients are</p>
\[ \frac{a_{0}}{2}=\frac{1}{2\pi}\int_{-\pi}^{\pi}x^{2}\,dx=\frac{\pi^{2}}{3},\qquad a_{n}=\frac{1}{\pi}\int_{-\pi}^{\pi}x^{2}\cos(nx)\,dx=\frac{4(-1)^{n}}{n^{2}}. \]
\[ x^{2}=\frac{\pi^{2}}{3}+\sum_{n=1}^{\infty}\frac{4(-1)^{n}}{n^{2}}\cos(nx). \]
<p>At \(x=\pi\), \(\cos(n\pi)=(-1)^{n}\), so \(\pi^{2}=\tfrac{\pi^{2}}{3}+4\sum\tfrac{1}{n^{2}}\), giving</p>
\[ \boxed{\sum_{n=1}^{\infty}\frac{1}{n^{2}}=\frac{\pi^{2}}{6}}. \]`,
        solution_hy: r`<p>\(f\)-ը զույգ է, ուստի հայտնվում են միայն կոսինուսային անդամներ։ Գործակիցներն են</p>
\[ \frac{a_{0}}{2}=\frac{1}{2\pi}\int_{-\pi}^{\pi}x^{2}\,dx=\frac{\pi^{2}}{3},\qquad a_{n}=\frac{1}{\pi}\int_{-\pi}^{\pi}x^{2}\cos(nx)\,dx=\frac{4(-1)^{n}}{n^{2}}. \]
\[ x^{2}=\frac{\pi^{2}}{3}+\sum_{n=1}^{\infty}\frac{4(-1)^{n}}{n^{2}}\cos(nx). \]
<p>\(x=\pi\)-ում \(\cos(n\pi)=(-1)^{n}\), ուստի \(\pi^{2}=\tfrac{\pi^{2}}{3}+4\sum\tfrac{1}{n^{2}}\), որ տալիս է</p>
\[ \boxed{\sum_{n=1}^{\infty}\frac{1}{n^{2}}=\frac{\pi^{2}}{6}}. \]`,
      },
      {
        type: "problem",
        title: "DFT of a two-spike sequence",
        title_hy: "Երկու-գագաթ հաջորդականության DFT",
        source: "HW 11 · Problem 3",
        prompt: "Only two terms survive the DFT sum.",
        prompt_hy: "DFT գումարից վերապրում են միայն երկու անդամ։",
        statement: r`<p>Find the DFT of \( x_{n}=\delta_{n}+0.9\,\delta_{n-6} \), \(n=0,1,\dots,8\) (so \(N=9\)).</p>`,
        statement_hy: r`<p>Գտի՛ր \( x_{n}=\delta_{n}+0.9\,\delta_{n-6} \)-ի DFT-ն, \(n=0,1,\dots,8\) (այսինքն \(N=9\))։</p>`,
        solution: r`<p>The DFT is \(X_{k}=\sum_{n=0}^{8}x_{n}e^{-i2\pi kn/9}\). Only \(n=0\) and \(n=6\) are nonzero:</p>
\[ X_{k}=1+0.9\,e^{-i\,2\pi\cdot 6k/9}=\boxed{\,1+0.9\,e^{-i\,4\pi k/3}\,},\qquad k=0,1,\dots,8. \]
<p>For example \(X_{0}=1+0.9=1.9\).</p>`,
        solution_hy: r`<p>DFT-ն է \(X_{k}=\sum_{n=0}^{8}x_{n}e^{-i2\pi kn/9}\)։ Ոչ-զրո են միայն \(n=0\)-ն և \(n=6\)-ը.</p>
\[ X_{k}=1+0.9\,e^{-i\,2\pi\cdot 6k/9}=\boxed{\,1+0.9\,e^{-i\,4\pi k/3}\,},\qquad k=0,1,\dots,8. \]
<p>Օրինակ՝ \(X_{0}=1+0.9=1.9\)։</p>`,
      },
    ],
  };

  for (const [id, exercises] of Object.entries(EX)) {
    if (byId[id]) byId[id].exercises = exercises;
  }

  /* ---------- homework PDF material buttons for these lessons ---------- */
  const A = "../assets/courses/math/";
  const HW = {
    "math-2-1": [5], "math-2-2": [5], "math-2-3": [5],
    "math-2-4": [6], "math-2-5": [6], "math-2-6": [6, 7], "math-2-7": [7],
    "math-3-1": [7, 8], "math-3-2": [8, 9], "math-3-3": [10], "math-3-4": [10], "math-3-5": [9],
    "math-4-1": [11], "math-4-2": [11],
  };
  for (const [id, nums] of Object.entries(HW)) {
    const lesson = byId[id];
    if (!lesson) continue;
    if (!lesson.materials) lesson.materials = [];
    for (const n of nums) {
      lesson.materials.push({
        label: "Problem set: Homework " + n + " (PDF)",
        href: A + "Homeworks/Homework " + n + ".pdf",
      });
    }
  }
})();
