/* 1991 Academy track: Web Development */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.tracks.web = {
  id: "web",
  title: "Web Development",
  tagline: "From your first HTML tag to interactive apps — understand the platform, don't just copy snippets.",
  icon: "🌐",
  accent: "#f59e0b",
  accentSoft: "rgba(245, 158, 11, 0.14)",
  modules: [
    {
      id: "web-m1",
      title: "Foundations",
      lessons: [
        {
          id: "web-1-1",
          title: "How the Web Actually Works",
          minutes: 10,
          content: `
<p>Every time you open a website, a tiny, elegant conversation happens. Understanding it turns the web from magic into a machine you can reason about.</p>
<h3>The journey of a URL</h3>
<p>When you type <code>example.com</code> and press Enter:</p>
<ol>
<li><strong>DNS lookup</strong> — your browser asks the Domain Name System to translate the human-friendly name into an IP address, like a phone book for the internet.</li>
<li><strong>HTTP request</strong> — the browser sends a request to that address: <em>"GET / — give me the page."</em> Requests carry a method (GET, POST, PUT, DELETE), headers, and sometimes a body.</li>
<li><strong>Server response</strong> — the server answers with a status code (<code>200</code> OK, <code>404</code> Not Found, <code>500</code> Server Error) and the content, usually HTML.</li>
<li><strong>Rendering</strong> — the browser parses HTML, discovers CSS and JS files, fetches them, and paints pixels.</li>
</ol>
<pre><code>GET /index.html HTTP/1.1
Host: example.com
Accept: text/html

HTTP/1.1 200 OK
Content-Type: text/html

&lt;!DOCTYPE html&gt; ...</code></pre>
<div class="callout">💡 <span>The web is <strong>stateless</strong>: each request stands alone. Cookies, tokens and sessions exist precisely to fake continuity on top of that.</span></div>
<p>Everything in web development — caching, APIs, authentication, performance — is a variation on this request/response loop. Master the loop and the rest becomes details.</p>`,
          takeaways: [
            "DNS turns names into IP addresses; HTTP moves the content.",
            "Every response has a status code — learn 200, 301, 404, 500 by heart.",
            "HTTP is stateless; cookies and tokens add memory on top.",
            "The browser is a rendering engine: HTML → structure, CSS → style, JS → behavior.",
          ],
          quiz: [
            {
              q: "What does DNS do?",
              options: [
                "Encrypts traffic between browser and server",
                "Translates domain names into IP addresses",
                "Stores website files in the cloud",
                "Compresses HTML before sending it",
              ],
              answer: 1,
              explain: "DNS is the internet's phone book: it maps human-readable names like example.com to machine addresses like 93.184.216.34.",
            },
            {
              q: "A server responds with status code 404. What happened?",
              options: [
                "The request succeeded",
                "The server crashed",
                "The requested resource was not found",
                "You are not authorized",
              ],
              answer: 2,
              explain: "4xx codes mean the client asked for something the server can't fulfill; 404 specifically means 'not found'. Server crashes are 5xx.",
            },
            {
              q: "Why do websites need cookies or tokens at all?",
              options: [
                "To make pages load faster",
                "Because HTTP is stateless and forgets you between requests",
                "Because browsers require them to render HTML",
                "To compress images",
              ],
              answer: 1,
              explain: "Each HTTP request is independent. Cookies/tokens let the server recognize you across requests — that's how logins persist.",
            },
          ],
        },
        {
          id: "web-1-2",
          title: "HTML: Structure with Meaning",
          minutes: 12,
          videos: [
            { id: "UB1O30fR-EE", title: "HTML Crash Course for Absolute Beginners", channel: "Traversy Media", length: "1 h" },
          ],
          content: `
<p>HTML isn't about how things look — it's about what things <em>are</em>. That distinction is what separates professional markup from tag soup.</p>
<h3>Semantic elements</h3>
<p>A <code>&lt;div&gt;</code> says nothing. A <code>&lt;nav&gt;</code>, <code>&lt;article&gt;</code>, or <code>&lt;button&gt;</code> tells browsers, screen readers, and search engines exactly what they're dealing with:</p>
<pre><code>&lt;article&gt;
  &lt;header&gt;
    &lt;h2&gt;Why semantics matter&lt;/h2&gt;
    &lt;time datetime="2026-07-05"&gt;July 5&lt;/time&gt;
  &lt;/header&gt;
  &lt;p&gt;Screen readers can jump straight to this article...&lt;/p&gt;
  &lt;footer&gt;&lt;a href="/more"&gt;Read more&lt;/a&gt;&lt;/footer&gt;
&lt;/article&gt;</code></pre>
<h3>The rules that matter</h3>
<ul>
<li><strong>One <code>&lt;h1&gt;</code> per page</strong>, headings in order (h1 → h2 → h3). Headings are the document's outline, not font sizes.</li>
<li><strong>Buttons do things, links go places.</strong> If it navigates, it's an <code>&lt;a&gt;</code>; if it triggers an action, it's a <code>&lt;button&gt;</code>.</li>
<li><strong>Every image gets <code>alt</code> text</strong> describing its content — or <code>alt=""</code> if purely decorative.</li>
<li><strong>Forms need <code>&lt;label&gt;</code>s</strong> connected to inputs. Placeholder text is not a label.</li>
</ul>
<div class="callout">💡 <span>Accessibility is not an add-on. Semantic HTML gives you keyboard navigation, screen-reader support, and better SEO <strong>for free</strong>.</span></div>
<p>Write HTML as if CSS didn't exist. If the raw document still reads like a sensible outline, you've done it right.</p>`,
          takeaways: [
            "Semantics describe meaning; CSS handles appearance.",
            "Headings form the document outline — never pick them for size.",
            "Buttons act, links navigate. Mixing them up breaks accessibility.",
            "Semantic HTML gives accessibility and SEO for free.",
          ],
          quiz: [
            {
              q: "You need a clickable element that submits a form. Which tag?",
              options: ["<div onclick=...>", "<a href='#'>", "<button>", "<span>"],
              answer: 2,
              explain: "Buttons trigger actions and come with keyboard support and correct semantics built in. Divs and spans have none of that.",
            },
            {
              q: "Why should headings follow order (h1 → h2 → h3)?",
              options: [
                "Browsers refuse to render out-of-order headings",
                "They form the document outline used by screen readers and search engines",
                "It makes the page load faster",
                "CSS only works on ordered headings",
              ],
              answer: 1,
              explain: "Headings are a table of contents. Screen-reader users navigate by them; skipping levels breaks that map.",
            },
            {
              q: "An image is purely decorative. What alt text should it have?",
              options: ["alt='image'", "alt='decoration'", "No alt attribute at all", "alt='' (empty)"],
              answer: 3,
              explain: "Empty alt tells assistive tech to skip it. Omitting alt entirely makes screen readers announce the filename — noise.",
            },
          ],
        },
        {
          id: "web-1-3",
          title: "CSS: The Modern Layout Toolkit",
          minutes: 14,
          videos: [
            { id: "yfoY53QXEnI", title: "CSS Crash Course for Absolute Beginners", channel: "Traversy Media", length: "1.5 h" },
          ],
          content: `
<p>CSS used to be fought; now it's driven. Two layout systems — <strong>Flexbox</strong> and <strong>Grid</strong> — plus custom properties cover 95% of real-world layout.</p>
<h3>Flexbox: one dimension</h3>
<p>Use flex when arranging items in a row <em>or</em> a column — navbars, toolbars, card innards:</p>
<pre><code>.navbar {
  display: flex;
  align-items: center;       /* cross-axis */
  justify-content: space-between; /* main axis */
  gap: 16px;
}</code></pre>
<h3>Grid: two dimensions</h3>
<p>Use grid when rows <em>and</em> columns matter at once — page shells, galleries, dashboards:</p>
<pre><code>.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}</code></pre>
<p>That one rule gives you a responsive gallery with zero media queries: columns appear and disappear as space allows.</p>
<h3>Custom properties: your design system</h3>
<pre><code>:root {
  --accent: #f59e0b;
  --radius: 12px;
}
.card {
  border-radius: var(--radius);
  border-color: var(--accent);
}</code></pre>
<p>Define tokens once, reuse everywhere, theme by swapping values (this very site switches dark/light by changing variables on one attribute).</p>
<div class="callout">💡 <span>Rule of thumb: content flowing in one direction → <strong>flex</strong>; explicit rows and columns → <strong>grid</strong>. Don't agonize — they compose.</span></div>`,
          takeaways: [
            "Flexbox = one dimension, Grid = two dimensions.",
            "minmax() + auto-fill gives responsive grids without media queries.",
            "Custom properties turn CSS into a themable design system.",
            "gap works in both flex and grid — stop using margin hacks.",
          ],
          exercises: [
            {
              type: "blanks",
              title: "Complete the responsive gallery",
              prompt: "Fill the blanks so this gallery reflows automatically with zero media queries.",
              code: ".gallery {\n  display: {{0}};\n  grid-template-columns: repeat({{1}}, minmax(240px, 1fr));\n  gap: 16px;\n}",
              blanks: [
                { options: ["grid", "flex", "block"], answer: 0 },
                { options: ["auto-fill", "4", "space-between"], answer: 0 },
              ],
            },
          ],
          quiz: [
            {
              q: "You're building a photo gallery with rows and columns that reflow. Best tool?",
              options: ["Floats", "Flexbox", "CSS Grid", "Absolute positioning"],
              answer: 2,
              explain: "Grid is built for two-dimensional layouts. auto-fill + minmax makes the gallery responsive with a single rule.",
            },
            {
              q: "What does justify-content control in a flex row?",
              options: [
                "Spacing along the main axis (horizontal in a row)",
                "Alignment on the cross axis",
                "Text justification inside items",
                "The order of items",
              ],
              answer: 0,
              explain: "justify-content distributes items along the main axis; align-items handles the cross axis.",
            },
            {
              q: "Biggest benefit of CSS custom properties over hard-coded values?",
              options: [
                "They render faster",
                "One definition, reused and swappable everywhere — enabling themes",
                "They work in older browsers",
                "They compress better",
              ],
              answer: 1,
              explain: "Change --accent in one place and the whole UI follows. Swap values under [data-theme='light'] and you have theming.",
            },
          ],
        },
      ],
    },
    {
      id: "web-m2",
      title: "Making It Interactive",
      lessons: [
        {
          id: "web-2-1",
          title: "JavaScript & the DOM",
          minutes: 14,
          videos: [
            { id: "hdI2bqOjy3c", title: "JavaScript Crash Course for Beginners", channel: "Traversy Media", length: "1.7 h" },
          ],
          content: `
<p>The DOM (Document Object Model) is the browser's live, in-memory version of your HTML. JavaScript's superpower is reading and rewriting it while the user watches.</p>
<h3>Select, then act</h3>
<pre><code>const button = document.querySelector(".buy-btn");
const items = document.querySelectorAll(".cart-item");

button.textContent = "Added!";
button.classList.add("success");</code></pre>
<h3>Events: the heartbeat of interactivity</h3>
<p>Everything a user does fires events. You listen and respond:</p>
<pre><code>button.addEventListener("click", (event) =&gt; {
  event.preventDefault();      // stop default behavior
  cart.add(currentItem);
  render();
});</code></pre>
<h3>Event delegation — the pro move</h3>
<p>Instead of attaching a listener to every list item (slow, breaks when items are added later), attach <em>one</em> listener to the parent and inspect what was clicked:</p>
<pre><code>list.addEventListener("click", (e) =&gt; {
  const item = e.target.closest(".cart-item");
  if (item) removeFromCart(item.dataset.id);
});</code></pre>
<p>This works because events <strong>bubble</strong> up from the clicked element through its ancestors. This site's quiz engine uses exactly this pattern.</p>
<div class="callout">💡 <span>A clean mental model: <strong>state</strong> lives in JavaScript, the DOM is a <strong>projection</strong> of it. Change state, then re-render — don't scatter truth across the page.</span></div>`,
          takeaways: [
            "The DOM is a live tree; querySelector finds nodes, properties mutate them.",
            "Events bubble upward — delegation uses one parent listener for many children.",
            "Keep state in JS and treat the DOM as its projection.",
            "preventDefault stops built-in behavior when you take over.",
          ],
          exercises: [
            {
              type: "order",
              title: "Assemble the delegated click handler",
              prompt: "Put the lines in order to build one listener that handles every current and future .todo item.",
              lines: [
                'list.addEventListener("click", (e) => {',
                '  const item = e.target.closest(".todo");',
                "  if (!item) return;",
                "  toggleDone(item.dataset.id);",
                "});",
              ],
            },
          ],
          quiz: [
            {
              q: "Why is event delegation better than a listener per list item?",
              options: [
                "It's the only way events work",
                "One listener handles current AND future children, with less memory",
                "It prevents all bugs",
                "Browsers require it for lists",
              ],
              answer: 1,
              explain: "Bubbling means the parent hears every child click — including elements added after page load. One listener, zero re-binding.",
            },
            {
              q: "What does event.preventDefault() do on a form's submit event?",
              options: [
                "Stops the browser from reloading the page with a native form submission",
                "Deletes the form data",
                "Blocks all future submissions",
                "Validates the inputs",
              ],
              answer: 0,
              explain: "Native form submission navigates/reloads. preventDefault lets your JS handle the data instead — the basis of every SPA form.",
            },
            {
              q: "Where should application state ideally live?",
              options: [
                "Spread across DOM attributes",
                "In JavaScript variables/objects, with the DOM rendered from it",
                "In CSS classes",
                "In the URL only",
              ],
              answer: 1,
              explain: "When JS owns the truth and the DOM merely reflects it, updates stay consistent — the core idea behind React and friends.",
            },
          ],
        },
        {
          id: "web-2-2",
          title: "Async JavaScript & Talking to APIs",
          minutes: 15,
          content: `
<p>JavaScript runs on a single thread — yet pages fetch data, run timers and stay responsive. The trick is <strong>asynchronous</strong> code: start slow work, get notified when it finishes.</p>
<h3>Promises and async/await</h3>
<p>A Promise is a placeholder for a value that will exist later. <code>async/await</code> is syntax that makes promise code read like normal code:</p>
<pre><code>async function loadUser(id) {
  try {
    const res = await fetch("/api/users/" + id);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const user = await res.json();
    render(user);
  } catch (err) {
    showError("Could not load user: " + err.message);
  }
}</code></pre>
<p>Three habits that separate juniors from seniors:</p>
<ul>
<li><strong>Always check <code>res.ok</code></strong> — fetch only rejects on network failure, not on 404 or 500.</li>
<li><strong>Always handle errors</strong> — a try/catch (or .catch) around every await that can fail.</li>
<li><strong>Show loading states</strong> — the user should never stare at a frozen page wondering.</li>
</ul>
<h3>Run things in parallel</h3>
<pre><code>const [user, posts] = await Promise.all([
  fetch("/api/user").then(r =&gt; r.json()),
  fetch("/api/posts").then(r =&gt; r.json()),
]);</code></pre>
<p>Two sequential awaits take the <em>sum</em> of their times; <code>Promise.all</code> takes the <em>max</em>. On real networks that's often the difference between sluggish and snappy.</p>
<div class="callout">💡 <span>JSON is the lingua franca of APIs: <code>res.json()</code> parses incoming data, <code>JSON.stringify</code> prepares outgoing bodies.</span></div>`,
          takeaways: [
            "async/await is readable syntax over Promises.",
            "fetch doesn't reject on 404/500 — check res.ok yourself.",
            "Promise.all runs independent requests in parallel.",
            "Every await needs an error path and the UI needs a loading state.",
          ],
          quiz: [
            {
              q: "fetch() returned successfully but the server sent 500. What happens without a res.ok check?",
              options: [
                "The catch block runs automatically",
                "Your code continues as if it succeeded and likely breaks parsing the body",
                "The browser retries",
                "fetch throws a SyntaxError",
              ],
              answer: 1,
              explain: "fetch resolves for any HTTP response. Only network failures reject — status checking is your job.",
            },
            {
              q: "Two independent API calls each take 300ms. Time with Promise.all vs sequential awaits?",
              options: [
                "~600ms either way",
                "~300ms either way",
                "~300ms with Promise.all, ~600ms sequential",
                "~150ms with Promise.all",
              ],
              answer: 2,
              explain: "Sequential awaits wait for one before starting the next (sum). Promise.all starts both at once (max).",
            },
            {
              q: "Why does single-threaded JavaScript not freeze during a fetch?",
              options: [
                "Fetch secretly uses a second thread you manage",
                "The browser performs the I/O and queues a callback; JS keeps running",
                "The page actually does freeze",
                "Fetch is instantaneous",
              ],
              answer: 1,
              explain: "The event loop model: slow I/O is handed to the browser, and your continuation runs from the queue when results arrive.",
            },
          ],
        },
        {
          id: "web-2-3",
          title: "From Pages to Apps: Components & State",
          minutes: 13,
          content: `
<p>Once an interface has more than a few moving parts, ad-hoc DOM manipulation collapses under its own weight. Modern frameworks (React, Vue, Svelte) all converge on the same two ideas.</p>
<h3>Idea 1: Components</h3>
<p>Split the UI into self-contained pieces that own their markup, style and logic — a <code>SearchBar</code>, a <code>ProductCard</code>, a <code>CartBadge</code>. Compose big screens from small parts, reuse the parts everywhere.</p>
<h3>Idea 2: UI = f(state)</h3>
<p>Instead of manually patching the DOM after every change, describe what the UI should look like <em>for a given state</em>, and let the framework reconcile reality:</p>
<pre><code>function CartBadge({ items }) {
  return &lt;span className="badge"&gt;{items.length}&lt;/span&gt;;
}
// add an item → state changes → badge re-renders. No manual DOM work.</code></pre>
<p>You already saw this philosophy in vanilla JS: keep truth in variables, re-render from them. Frameworks just automate the re-rendering efficiently.</p>
<h3>Choosing your path</h3>
<ul>
<li><strong>Learn vanilla first.</strong> Frameworks make far more sense when you know what they're saving you from.</li>
<li><strong>React</strong> has the biggest ecosystem and job market; <strong>Vue</strong> and <strong>Svelte</strong> are gentler and beloved.</li>
<li><strong>Don't reach for a framework for a page with two buttons.</strong> This entire site is vanilla JS — and that was the right call for its size.</li>
</ul>
<div class="callout">💡 <span>Framework churn is loud, but the fundamentals — HTTP, DOM, async, components, state — transfer everywhere and outlive every hype cycle.</span></div>`,
          takeaways: [
            "Components: self-contained, composable UI pieces.",
            "Declarative rendering: describe UI as a function of state.",
            "Frameworks automate what you already did manually in vanilla JS.",
            "Fundamentals outlive frameworks — invest there first.",
          ],
          quiz: [
            {
              q: "What does 'UI = f(state)' mean?",
              options: [
                "The UI is written in functional CSS",
                "For any given state, the UI is a predictable rendering of it",
                "State must be stored in the URL",
                "Functions may never touch the DOM",
              ],
              answer: 1,
              explain: "You declare what the screen looks like for each state; the framework updates the DOM when state changes. No manual patching.",
            },
            {
              q: "When is a big framework probably the WRONG choice?",
              options: [
                "A 50-screen dashboard with live data",
                "A collaborative editor",
                "A mostly-static page with a contact form",
                "A social network feed",
              ],
              answer: 2,
              explain: "Frameworks pay off when state and interactivity are complex. For simple pages they add build steps and kilobytes for nothing.",
            },
          ],
        },
      ],
    },
    {
      id: "web-m3",
      title: "Professional Practice",
      lessons: [
        {
          id: "web-3-1",
          title: "Responsive & Mobile-First Design",
          minutes: 13,
          content: `
<p>Over 60% of web traffic is phones. Professionals don't "also support mobile" — they design for the smallest screen first and let layouts <em>earn</em> their complexity as space grows.</p>
<h3>Mobile-first media queries</h3>
<p>Write base styles for narrow screens, then add enhancements at breakpoints with <code>min-width</code>:</p>
<pre><code>/* base: single column, works everywhere */
.layout { display: grid; gap: 16px; }

@media (min-width: 768px) {          /* tablet+: add a sidebar */
  .layout { grid-template-columns: 240px 1fr; }
}</code></pre>
<p>The other direction (<code>max-width</code>, desktop-first) forces you to <em>undo</em> styles — more code, more bugs.</p>
<h3>Fluid, not stepped</h3>
<p>Modern CSS often removes breakpoints entirely:</p>
<pre><code>h1   { font-size: clamp(1.6rem, 4vw, 2.8rem); }  /* fluid type */
.box { width: min(680px, 100% - 32px); }          /* fluid width */
.grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }</code></pre>
<p><code>clamp(min, preferred, max)</code> scales smoothly between bounds — one line replaces three media queries.</p>
<h3>Responsive images</h3>
<p>Don't ship a 4000px photo to a 360px phone. <code>srcset</code> lets the browser pick:</p>
<pre><code>&lt;img src="hero-800.jpg"
     srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
     sizes="(min-width: 800px) 50vw, 100vw" alt="…" /&gt;</code></pre>
<div class="callout">💡 <span>Test like a pro: DevTools device toolbar, then a <strong>real phone</strong> — touch targets (min ~44px), thumb reach and slow networks only show up on hardware.</span></div>`,
          takeaways: [
            "Mobile-first: base styles for small screens, min-width queries add complexity.",
            "clamp(), min() and auto-fit grids replace whole stacks of breakpoints.",
            "srcset/sizes serves each device an appropriately sized image.",
            "Touch targets ≥ ~44px; always test on a real device.",
          ],
          exercises: [
            {
              type: "blanks",
              title: "Make this hero fluid",
              prompt: "Pick the values that scale the heading smoothly and add the sidebar only when space allows.",
              code: "h1 { font-size: {{0}}(1.5rem, 4vw, 2.6rem); }\n\n@media ({{1}}: 768px) {\n  .layout { grid-template-columns: 240px 1fr; }\n}",
              blanks: [
                { options: ["clamp", "calc", "var"], answer: 0 },
                { options: ["min-width", "max-width", "width"], answer: 0 },
              ],
            },
          ],
          quiz: [
            {
              q: "Why is mobile-first (min-width queries) preferred over desktop-first?",
              options: [
                "Phones can't read max-width queries",
                "Base styles stay simple and enhancements are added, instead of desktop styles being undone",
                "It makes fonts bigger",
                "Google requires it",
              ],
              answer: 1,
              explain: "Small-screen layout is the simple case. Starting there means each breakpoint only ADDS complexity — less code to override, fewer bugs.",
            },
            {
              q: "font-size: clamp(1.5rem, 4vw, 2.6rem) means…",
              options: [
                "Exactly 4vw on every screen",
                "Scales with viewport width but never below 1.5rem or above 2.6rem",
                "1.5rem on mobile, 2.6rem on desktop, nothing between",
                "A random size in that range",
              ],
              answer: 1,
              explain: "clamp(min, preferred, max): the middle value applies only while it stays inside the bounds — fluid typography in one declaration.",
            },
            {
              q: "The main purpose of srcset on images is…",
              options: [
                "Adding a caption",
                "Letting the browser download an appropriately sized file for the device",
                "Lazy loading",
                "Rounding the corners",
              ],
              answer: 1,
              explain: "You list candidate files with their widths; the browser weighs screen size and pixel density and fetches the smallest adequate one.",
            },
          ],
        },
        {
          id: "web-3-2",
          title: "Web Performance: Make It Fast",
          minutes: 14,
          content: `
<p>Performance is a feature users feel before any other. Amazon famously measured ~1% revenue loss per 100ms of latency; slow sites bleed users silently.</p>
<h3>The critical rendering path</h3>
<p>The browser can't paint until it has parsed HTML and CSS — and by default, scripts <strong>block</strong> parsing. Hence the two golden attributes:</p>
<pre><code>&lt;script src="app.js" defer&gt;&lt;/script&gt;  ← downloads in parallel,
                                          runs after parsing (usual choice)
&lt;script src="ads.js" async&gt;&lt;/script&gt;  ← runs whenever ready (independent code)</code></pre>
<h3>Images: the usual suspect</h3>
<p>Images are typically 50%+ of page weight. The checklist:</p>
<ul>
<li><strong>Modern formats</strong> — WebP/AVIF are 30–70% smaller than JPEG.</li>
<li><strong>Lazy loading</strong> — <code>loading="lazy"</code> skips offscreen images until scrolled near (1991 Academy does this for video thumbnails).</li>
<li><strong>Explicit dimensions</strong> — width/height attributes prevent layout jumps.</li>
</ul>
<h3>Core Web Vitals: how speed is scored</h3>
<pre><code>LCP  Largest Contentful Paint  &lt; 2.5s   "when does the main thing show?"
CLS  Cumulative Layout Shift   &lt; 0.1    "does the page jump around?"
INP  Interaction to Next Paint &lt; 200ms  "does it respond when I click?"</code></pre>
<p>These are measurable in Lighthouse (DevTools → Lighthouse tab) and affect search ranking — performance is SEO.</p>
<div class="callout">💡 <span>Professional habit: measure <em>before</em> optimizing. Lighthouse names the exact bottleneck; fixing anything else is guesswork with a good conscience.</span></div>`,
          takeaways: [
            "Scripts block parsing — defer is the default professional choice.",
            "Images dominate page weight: modern formats + lazy loading + explicit dimensions.",
            "Know the vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms.",
            "Measure with Lighthouse first; optimize what it names.",
          ],
          quiz: [
            {
              q: "What does the defer attribute on a script do?",
              options: [
                "Skips the script on slow connections",
                "Downloads in parallel with parsing and executes after the document is parsed",
                "Runs the script twice",
                "Minifies the script",
              ],
              answer: 1,
              explain: "Without it, the parser stops dead at every script tag. defer keeps HTML parsing moving and runs code at the right moment.",
            },
            {
              q: "A page's text visibly jumps down as an image loads above it. Which vital suffers?",
              options: ["LCP", "CLS", "INP", "TTL"],
              answer: 1,
              explain: "Cumulative Layout Shift measures unexpected movement. Reserving space with width/height attributes fixes it.",
            },
            {
              q: "The highest-impact first step for a slow image-heavy page is usually…",
              options: [
                "Rewriting in a new framework",
                "Compressing/serving modern formats and lazy-loading offscreen images",
                "Adding a loading spinner",
                "Buying a faster server",
              ],
              answer: 1,
              explain: "Images are usually most of the bytes. Format + lazy loading routinely cuts page weight in half before touching any code.",
            },
          ],
        },
        {
          id: "web-3-3",
          title: "Security Essentials Every Dev Needs",
          minutes: 15,
          content: `
<p>Security isn't a specialist topic — the same five attacks compromise most web apps, and each has a standard, boring, effective defense.</p>
<h3>XSS — Cross-Site Scripting</h3>
<p>Attacker-supplied text gets executed as HTML/JS. A comment like <code>&lt;script&gt;steal(document.cookie)&lt;/script&gt;</code> runs in every visitor's browser.</p>
<p><strong>Defense:</strong> escape output (turn <code>&lt;</code> into <code>&amp;lt;</code>) whenever user content enters HTML — plus a Content-Security-Policy header as a safety net. 1991 Academy's own <code>esc()</code> helper exists exactly for this.</p>
<h3>SQL injection</h3>
<p>User input concatenated into queries: the input <code>'; DROP TABLE users; --</code> becomes part of your SQL.</p>
<p><strong>Defense:</strong> parameterized queries, always — <code>execute("... WHERE name = ?", [name])</code>. 1991 Academy's server does this for every query.</p>
<h3>CSRF — Cross-Site Request Forgery</h3>
<p>A malicious site makes your logged-in browser fire a request to your bank — the cookie rides along automatically.</p>
<p><strong>Defense:</strong> <code>SameSite=Lax/Strict</code> cookies (the modern default) and CSRF tokens for sensitive actions.</p>
<h3>Secrets & passwords</h3>
<ul>
<li>Anything in frontend JS is <strong>public</strong> — API keys belong on the server.</li>
<li>Passwords are never stored, only <strong>salted slow hashes</strong> (bcrypt/scrypt/argon2).</li>
<li>HTTPS everywhere; without it, every cookie and password travels in plain text.</li>
</ul>
<div class="callout">💡 <span>The professional mindset in one sentence: <strong>all input is hostile until proven otherwise</strong> — whether it comes from a form, a URL, an API, or an AI model (remember prompt injection from the Agents track?).</span></div>`,
          takeaways: [
            "XSS: escape all user content entering HTML; add CSP.",
            "SQL injection: parameterized queries, no exceptions.",
            "CSRF: SameSite cookies + tokens on sensitive actions.",
            "Client code is public; passwords only ever exist as salted slow hashes.",
          ],
          exercises: [
            {
              type: "match",
              title: "Match the attack to its standard defense",
              prompt: "Every classic web attack has a boring, effective counter. Pair them.",
              pairs: [
                ["XSS (injected scripts)", "Escape output + Content-Security-Policy"],
                ["SQL injection", "Parameterized queries"],
                ["CSRF (forged requests)", "SameSite cookies + CSRF tokens"],
                ["Stolen password database", "Salted slow hashes (scrypt/bcrypt)"],
              ],
            },
          ],
          quiz: [
            {
              q: "A user's comment shows as text like '<script>…' instead of executing. Why?",
              options: [
                "The browser blocked JavaScript",
                "The site escaped the output, turning < into &lt; before inserting it into HTML",
                "Comments can't contain scripts",
                "The script had a syntax error",
              ],
              answer: 1,
              explain: "Escaping converts markup characters to harmless text entities — the content displays but never parses as HTML. That's XSS defense working.",
            },
            {
              q: "Why must API keys never live in frontend JavaScript?",
              options: [
                "It slows the page down",
                "Anything shipped to the browser is readable by every user",
                "Browsers delete them",
                "Keys expire faster in JS",
              ],
              answer: 1,
              explain: "View Source shows everything. Secrets belong on a server that makes the privileged call on the user's behalf.",
            },
            {
              q: "Databases should store which of these for passwords?",
              options: [
                "The password, encrypted with a site-wide key",
                "A salted hash from a deliberately slow function like scrypt",
                "The password in plain text over HTTPS",
                "The last four characters",
              ],
              answer: 1,
              explain: "Slow + salted means a stolen database can't be cheaply brute-forced and identical passwords don't share hashes.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.push("web");
