/* 1991 Academy track: Agentic AI */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.tracks.agents = {
  id: "agents",
  title: "Agentic AI",
  tagline: "From chatbots to agents that plan, use tools and act — the engineering behind autonomous AI.",
  icon: "🤖",
  accent: "#34d399",
  accentSoft: "rgba(52, 211, 153, 0.14)",
  modules: [
    {
      id: "agents-m1",
      title: "From Chatbots to Agents",
      lessons: [
        {
          id: "agents-1-1",
          title: "What Makes an Agent an Agent",
          minutes: 11,
          videos: [
            { id: "zjkBMFhNj_g", title: "Intro to Large Language Models (1 h talk)", channel: "Andrej Karpathy", length: "1 h" },
          ],
          content: `
<p>A chatbot answers. An <strong>agent</strong> pursues a goal: it decides what to do, does it, looks at what happened, and decides again. The difference is the loop.</p>
<h3>The agent loop</h3>
<pre><code>while goal not reached:
  1. observe   — read the current state (conversation, tool results, files)
  2. reason    — decide the next action
  3. act       — call a tool: search, run code, write a file, call an API
  4. observe the result … and loop</code></pre>
<p>An LLM provides the <em>reason</em> step. Everything around it — tools, memory, stopping conditions — is regular software engineering, and it's where most of the craft lives.</p>
<h3>The anatomy of an agent</h3>
<ul>
<li><strong>Model</strong> — the reasoning engine (an LLM).</li>
<li><strong>Tools</strong> — functions the model may invoke: web search, code execution, database queries.</li>
<li><strong>Memory / context</strong> — the conversation so far, retrieved documents, scratch notes.</li>
<li><strong>Orchestration</strong> — the loop itself: parsing tool calls, executing them, feeding results back, deciding when to stop.</li>
</ul>
<h3>Autonomy is a dial, not a switch</h3>
<pre><code>level 0: chat — answer questions
level 1: single tool call when asked
level 2: multi-step plans, several tools per task
level 3: long-running goals, self-correction, sub-agents</code></pre>
<div class="callout">💡 <span>Design rule: give an agent the <strong>least autonomy that solves the problem</strong>. Every added step of freedom multiplies the ways a run can go sideways — and the cost of reviewing it.</span></div>`,
          takeaways: [
            "Agent = LLM reasoning inside an observe → reason → act loop.",
            "Tools, memory and orchestration are engineering, not magic.",
            "Autonomy is a spectrum; use the least that solves the problem.",
            "The loop's stopping conditions matter as much as its actions.",
          ],
          quiz: [
            {
              q: "What fundamentally distinguishes an agent from a plain chatbot?",
              options: [
                "A bigger model",
                "A loop where it acts, observes results, and decides next steps toward a goal",
                "A friendlier tone",
                "Faster responses",
              ],
              answer: 1,
              explain: "The defining feature is the feedback loop with actions in the world (tools), not model size or interface.",
            },
            {
              q: "In the agent loop, the LLM primarily supplies…",
              options: [
                "The tool execution runtime",
                "The reasoning/decision step",
                "The memory storage",
                "The network layer",
              ],
              answer: 1,
              explain: "The LLM decides what to do next; executing tools, storing memory and looping are handled by surrounding code.",
            },
            {
              q: "Why prefer the least autonomy that solves the problem?",
              options: [
                "Autonomy is expensive to license",
                "Each degree of freedom adds failure modes and review burden",
                "LLMs refuse autonomous tasks",
                "Lower autonomy is always more accurate",
              ],
              answer: 1,
              explain: "More independent steps = more places to compound errors and more output to verify. Match autonomy to the task's risk.",
            },
          ],
        },
        {
          id: "agents-1-2",
          title: "Tool Use & Function Calling",
          minutes: 13,
          content: `
<p>LLMs can't browse, compute reliably, or touch your database — until you hand them tools. <strong>Function calling</strong> is the protocol that makes it safe and structured.</p>
<h3>How it works</h3>
<ol>
<li>You describe each tool to the model: name, purpose, parameters (a JSON schema).</li>
<li>The model, mid-conversation, outputs a structured request: <em>call <code>get_weather</code> with <code>{"city": "Yerevan"}</code></em>.</li>
<li><strong>Your code</strong> executes the function — the model never runs anything itself.</li>
<li>You feed the result back; the model continues reasoning with it.</li>
</ol>
<pre><code>{
  "name": "get_weather",
  "description": "Current weather for a city",
  "parameters": {
    "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"]
  }
}</code></pre>
<h3>What separates good tools from bad ones</h3>
<ul>
<li><strong>Crisp descriptions.</strong> The model chooses tools by reading them — write for the model like you'd write docs for a hurried colleague.</li>
<li><strong>Small, composable surface.</strong> Ten focused tools beat one mega-tool with 30 modes.</li>
<li><strong>Informative errors.</strong> Return "city not found — try an ISO name" and the model self-corrects; return a stack trace and it flails.</li>
<li><strong>Guardrails in code.</strong> Validate arguments, sandbox side effects, require confirmation for destructive actions. Never trust arguments blindly.</li>
</ul>
<div class="callout">💡 <span><strong>MCP (Model Context Protocol)</strong> standardizes this pattern: tool servers describe their capabilities once, and any MCP-capable model/app can use them — USB for AI tools.</span></div>`,
          takeaways: [
            "The model requests tool calls as structured JSON; your code executes them.",
            "Tool descriptions are prompts — clarity determines correct usage.",
            "Good error messages let agents self-correct.",
            "Validate everything; treat model-supplied arguments as untrusted input.",
          ],
          exercises: [
            {
              type: "match",
              title: "Match the tool-design rule to its reason",
              prompt: "Each engineering habit exists for a specific failure it prevents.",
              pairs: [
                ["Crisp tool descriptions", "The model chooses tools purely by reading them"],
                ["Informative error messages", "Lets the agent self-correct instead of flailing"],
                ["Validate all arguments", "Model output is untrusted input"],
                ["Small, composable tools", "Ten focused tools beat one mega-tool"],
              ],
            },
          ],
          quiz: [
            {
              q: "Who actually executes a function call requested by the model?",
              options: [
                "The model, inside its neural network",
                "Your application code, which then returns the result to the model",
                "The GPU driver",
                "Nobody — it's hypothetical",
              ],
              answer: 1,
              explain: "The model only emits a structured request. Your runtime executes it — which is exactly where you enforce safety.",
            },
            {
              q: "An agent keeps misusing a tool. The highest-leverage first fix is usually…",
              options: [
                "Switching to a bigger model",
                "Rewriting the tool's description and parameter docs to be clearer",
                "Adding more tools",
                "Retrying failed calls automatically",
              ],
              answer: 1,
              explain: "The model picks and fills tools purely from their descriptions. Ambiguous docs → wrong calls. Fix the docs first.",
            },
            {
              q: "Why must tool arguments be validated even though an 'intelligent' model produced them?",
              options: [
                "Models bill per validation",
                "Model outputs can be wrong or manipulated (e.g., via prompt injection) — treat them as untrusted input",
                "JSON is unreliable",
                "Validation makes calls faster",
              ],
              answer: 1,
              explain: "The model can hallucinate arguments or be steered by adversarial content it read. Your code is the security boundary.",
            },
          ],
        },
        {
          id: "agents-1-3",
          title: "Prompting Agents: System Prompts & ReAct",
          minutes: 12,
          content: `
<p>An agent's behavior is programmed in two places: the code around the loop, and the <strong>prompts</strong> inside it. Prompting an agent is closer to writing an operations manual than asking a question.</p>
<h3>The system prompt is the job description</h3>
<p>It sets identity, capabilities, boundaries and tone — and it outranks user messages:</p>
<pre><code>You are a support agent for Acme.
- Use search_kb before answering product questions.
- Never promise refunds; open a ticket with open_ticket instead.
- If unsure, say so and escalate. Keep replies under 120 words.</code></pre>
<p>Notice the pattern: <em>capabilities → tool policy → hard limits → escape hatch</em>. Vague system prompts produce confidently improvising agents; crisp ones produce reliable ones.</p>
<h3>ReAct: reason, then act</h3>
<p>The classic agent pattern interleaves explicit thinking with tool use:</p>
<pre><code>Thought: the user wants Q2 revenue; I need the finance DB.
Action:  query_db("SELECT sum(revenue) ... WHERE quarter='Q2'")
Observation: 4.2M
Thought: I have the figure; now compare with Q1 as asked.
Action:  query_db("... WHERE quarter='Q1'")
Observation: 3.8M
Answer: Q2 revenue was 4.2M, up ~10.5% from Q1.</code></pre>
<p>Making reasoning explicit before each action measurably reduces flailing — the model commits to a plan step instead of pattern-matching straight to a tool call.</p>
<h3>Prompting habits that pay off</h3>
<ul>
<li><strong>Few-shot examples</strong> of ideal behavior beat paragraphs of description.</li>
<li><strong>Define the failure mode</strong>: tell the agent what to do when stuck (ask, stop, escalate) — otherwise it invents.</li>
<li><strong>Structured output</strong> (JSON schemas) wherever downstream code consumes results.</li>
</ul>
<div class="callout">💡 <span>Treat prompts like code: version them, test them against a suite of scenarios, and review diffs. A one-line prompt change can alter behavior more than a model upgrade.</span></div>`,
          takeaways: [
            "System prompt = job description: capabilities, tool policy, limits, escape hatch.",
            "ReAct interleaves explicit reasoning with actions, reducing flailing.",
            "Show ideal behavior with examples; specify what to do when stuck.",
            "Version and test prompts like the code they effectively are.",
          ],
          quiz: [
            {
              q: "The ReAct pattern alternates…",
              options: [
                "Training and inference",
                "Explicit reasoning steps with tool actions and observations",
                "Two different models",
                "User and system prompts",
              ],
              answer: 1,
              explain: "Thought → Action → Observation, repeated. Verbalizing the plan before acting improves tool-use accuracy.",
            },
            {
              q: "Why explicitly tell an agent what to do when it's unsure?",
              options: [
                "To lengthen the prompt",
                "Without a defined escape hatch, models tend to improvise confidently instead of stopping",
                "Models charge more for uncertainty",
                "It's required by APIs",
              ],
              answer: 1,
              explain: "LLMs are trained to be helpful and will fabricate rather than stall — unless you make 'say you're unsure / escalate' an approved action.",
            },
          ],
        },
      ],
    },
    {
      id: "agents-m2",
      title: "Building Real Agents",
      lessons: [
        {
          id: "agents-2-1",
          title: "Memory, Context & RAG",
          minutes: 14,
          videos: [
            { id: "T-D1OfcDW1M", title: "What is Retrieval-Augmented Generation (RAG)?", channel: "IBM Technology", length: "6 min" },
          ],
          content: `
<p>An LLM's context window is its entire working memory — finite, expensive, and wiped between sessions. Real agents need to know more than fits in it. The toolbox: retrieval.</p>
<h3>RAG: Retrieval-Augmented Generation</h3>
<p>Instead of hoping the model memorized your docs during training, fetch the relevant bits at question time and paste them into the prompt:</p>
<pre><code>offline:  docs → chunks → embeddings → vector index
online:   query → embed → find nearest chunks
          → prompt = instructions + top chunks + question
          → model answers grounded in YOUR data</code></pre>
<p><strong>Embeddings</strong> map text to vectors where similar meaning = nearby points, so "How do I reset my password?" retrieves the auth guide even with zero shared keywords.</p>
<h3>Where RAG actually fails (and fixes)</h3>
<ul>
<li><strong>Bad chunking</strong> — split mid-thought and retrieval returns fragments. Chunk along semantic boundaries (sections, paragraphs) with overlap.</li>
<li><strong>Retrieval misses</strong> — pure vector search struggles with exact codes/names. Hybrid search (vectors + keyword) is the standard fix.</li>
<li><strong>Context stuffing</strong> — more chunks ≠ better answers; irrelevant text dilutes attention. Retrieve more, then <strong>rerank</strong>, keep few.</li>
</ul>
<h3>Agent memory beyond documents</h3>
<pre><code>short-term: the conversation itself (summarize when it grows)
episodic:  past sessions, distilled into notes
long-term: facts worth persisting — often just files the
           agent reads and writes ("memory as a tool")</code></pre>
<div class="callout">💡 <span>Debug RAG systems from the bottom up: first check <em>what was retrieved</em>. In practice most "the model hallucinated" reports turn out to be "the retriever never found the right passage".</span></div>`,
          takeaways: [
            "RAG = retrieve relevant chunks at query time, ground the answer in them.",
            "Embeddings make semantic similarity searchable.",
            "Chunking quality, hybrid search and reranking decide real-world RAG quality.",
            "Debug retrieval before blaming the model.",
          ],
          quiz: [
            {
              q: "The main reason to use RAG instead of relying on the model's training data?",
              options: [
                "It makes the model faster",
                "It grounds answers in current, private, or domain-specific data the model never memorized",
                "It reduces GPU memory",
                "It removes the need for prompts",
              ],
              answer: 1,
              explain: "Training data is frozen and public-ish. RAG injects your live documents at question time — with sources you can cite.",
            },
            {
              q: "A RAG bot answers wrongly. The first thing to inspect is…",
              options: [
                "The model's temperature",
                "Which chunks the retriever actually returned",
                "The UI code",
                "The embedding dimension",
              ],
              answer: 1,
              explain: "If the right passage never reached the prompt, no model can answer correctly. Retrieval inspection is step one.",
            },
            {
              q: "Why can adding MORE retrieved chunks make answers worse?",
              options: [
                "It can't — more context is always better",
                "Irrelevant text dilutes attention and can mislead the model",
                "Chunks expire",
                "Embeddings become invalid",
              ],
              answer: 1,
              explain: "Models weigh everything in context. Noise competes with signal — hence retrieve-many, rerank, keep-few.",
            },
          ],
        },
        {
          id: "agents-2-2",
          title: "Multi-Agent Systems, Evaluation & Safety",
          minutes: 14,
          content: `
<p>One agent with twenty tools and five goals becomes unreliable. The scaling move is the same one software made decades ago: <strong>decompose into specialists</strong>.</p>
<h3>Common topologies</h3>
<pre><code>orchestrator → [researcher, coder, reviewer]   ← most common
pipeline:     draft → critique → revise         ← quality loops
debate:       two agents argue, judge decides   ← harder questions</code></pre>
<p>An orchestrator plans and delegates to sub-agents, each with a narrow role, its own prompt and only the tools it needs. Benefits: focused context per agent, parallelism, and permissions scoped per role. Cost: coordination overhead — don't reach for multi-agent when one good agent suffices.</p>
<h3>Evaluation: the unglamorous superpower</h3>
<p>Agents are stochastic; "it worked when I tried it" is not evidence. Teams that ship reliable agents all converge on the same practice:</p>
<ul>
<li><strong>Build a scenario suite</strong> — dozens of representative tasks with checkable outcomes.</li>
<li><strong>Score outcomes, not vibes</strong> — did the ticket get filed? does the code pass tests?</li>
<li><strong>Use LLM-as-judge carefully</strong> — good for fuzzy quality grading, but calibrate it against human labels.</li>
<li><strong>Run evals on every change</strong> — prompts, tools and models all regress silently.</li>
</ul>
<h3>Safety engineering, concretely</h3>
<ul>
<li><strong>Least privilege</strong> — read-only credentials unless writing is the job.</li>
<li><strong>Sandboxing</strong> — code execution in containers; spending/API budgets; step limits to kill runaway loops.</li>
<li><strong>Human-in-the-loop gates</strong> for irreversible actions: deploys, payments, deletions, external emails.</li>
<li><strong>Prompt injection defense</strong> — anything the agent reads (web pages, emails, docs) may contain instructions. Treat retrieved content as data, never as commands; the tool layer must enforce this, not the prompt.</li>
</ul>
<div class="callout">💡 <span>The uncomfortable truth of 2026-era agents: capability is rarely the bottleneck — <strong>reliability and containment</strong> are. The engineering patterns in this lesson are where production agents live or die.</span></div>`,
          takeaways: [
            "Decompose into specialist agents with narrow roles and scoped tools.",
            "Evaluate with scenario suites and outcome checks, on every change.",
            "Least privilege, sandboxes, budgets and human gates contain failures.",
            "Prompt injection: retrieved content is data, never instructions.",
          ],
          quiz: [
            {
              q: "The main advantage of an orchestrator with specialist sub-agents over one mega-agent?",
              options: [
                "It uses fewer tokens overall",
                "Each agent gets focused context, a narrow role, and only the tools/permissions it needs",
                "It never makes mistakes",
                "It requires no prompts",
              ],
              answer: 1,
              explain: "Decomposition cuts each agent's cognitive load and blast radius — the same reason we split code into modules with clear interfaces.",
            },
            {
              q: "An agent summarizing a web page suddenly tries to email your files, because the page said to. This is…",
              options: [
                "A hallucination",
                "Prompt injection — untrusted content acted as instructions",
                "A GPU error",
                "Normal agent behavior",
              ],
              answer: 1,
              explain: "Content the agent reads can smuggle commands. Defense lives in the tool layer: permissions, gates and treating input as data.",
            },
            {
              q: "Why do teams run an eval suite on every prompt change?",
              options: [
                "For compliance paperwork",
                "Because agent behavior is stochastic and regressions from small changes are silent otherwise",
                "To warm up the GPU",
                "Evals train the model",
              ],
              answer: 1,
              explain: "A one-line prompt edit can break behaviors you weren't watching. Automated scenario suites catch it before users do.",
            },
          ],
        },
      ],
    },
    {
      id: "agents-m3",
      title: "Production Agents",
      lessons: [
        {
          id: "agents-3-1",
          title: "Structured Outputs & Reliability",
          minutes: 13,
          content: `
<p>Demos tolerate prose; pipelines don't. The moment an LLM's answer feeds code — a database write, a UI, another agent — free-form text becomes a bug factory. Production agents speak <strong>schemas</strong>.</p>
<h3>Contract first</h3>
<p>Define the exact shape you need, and put it in the prompt (or use the API's native structured-output mode):</p>
<pre><code>{
  "sentiment": "positive | neutral | negative",
  "confidence": 0.0-1.0,
  "topics": ["string", ...]
}</code></pre>
<h3>The validate-retry loop</h3>
<p>Even schema-prompted models occasionally drift — a trailing comma, an invented field, a confidence of "high". Robust systems never trust, always verify:</p>
<pre><code>1. define the schema the pipeline expects
2. request the answer, schema in the prompt
3. parse the reply as JSON
4. validate fields against the schema
5. on failure → retry ONCE, feeding the exact error back
   ("confidence must be a number 0-1, got 'high'")
6. still failing → fallback path, never a crash</code></pre>
<p>Feeding the error back matters: models are good at fixing named mistakes, terrible at guessing unnamed ones — the same principle as informative tool errors.</p>
<h3>Reliability beyond parsing</h3>
<ul>
<li><strong>Timeouts + retries with backoff</strong> — API calls fail; plan for it.</li>
<li><strong>Idempotency</strong> — a retried "create ticket" step must not create two tickets. Use idempotency keys for side effects.</li>
<li><strong>Graceful degradation</strong> — cached answer, simpler model, or honest "try later" beat a stack trace.</li>
<li><strong>Log every step</strong> — prompts, outputs, validation failures. Debugging an agent without traces is archaeology.</li>
</ul>
<div class="callout">💡 <span>Treat the model like a brilliant, slightly unreliable API: <strong>contracts at the boundary, verification inside, fallbacks everywhere</strong>. That mindset is what "production-grade" means.</span></div>`,
          takeaways: [
            "Pipelines need schemas, not prose — define the output contract first.",
            "Parse → validate → retry once with the named error → fallback.",
            "Side effects need idempotency keys; retries must be safe.",
            "Log every step: traces are the only way to debug agents.",
          ],
          exercises: [
            {
              type: "order",
              title: "Assemble the reliability loop",
              prompt: "Order the steps of a production-grade structured-output call.",
              lines: [
                "define the JSON schema the pipeline expects",
                "request the answer with the schema in the prompt",
                "parse the model's reply as JSON",
                "validate the parsed fields against the schema",
                "on failure, retry once with the exact error included",
              ],
            },
          ],
          quiz: [
            {
              q: "Why feed the validation error back on retry instead of just asking again?",
              options: [
                "It uses fewer tokens",
                "Models reliably fix mistakes that are named; blind retries repeat them",
                "APIs require it",
                "It resets the temperature",
              ],
              answer: 1,
              explain: "'confidence must be a number, got high' gives the model something to correct — the retry converges instead of gambling.",
            },
            {
              q: "An agent step 'charge the customer' gets retried after a timeout. What prevents a double charge?",
              options: [
                "Hoping the first call failed",
                "An idempotency key: the payment API treats repeated calls with the same key as one operation",
                "Retrying faster",
                "Using a bigger model",
              ],
              answer: 1,
              explain: "Idempotency turns 'at least once' delivery into 'exactly once' effect — mandatory for money, emails, and any side effect.",
            },
            {
              q: "The model returns valid JSON but with an extra invented field. A robust pipeline…",
              options: [
                "Crashes with a parse error",
                "Validates against the schema, so the drift is caught and handled deliberately",
                "Stores the extra field just in case",
                "Switches providers",
              ],
              answer: 1,
              explain: "Parsing checks syntax; validation checks the contract. Both layers exist because both failure modes happen.",
            },
          ],
        },
        {
          id: "agents-3-2",
          title: "Cost, Latency & Model Selection",
          minutes: 13,
          content: `
<p>Agents multiply LLM calls — a single user request might trigger ten model invocations. At that point cost and latency stop being footnotes and become architecture.</p>
<h3>Token economics</h3>
<p>You pay per token, in and out — and agents resend context every step. A 20-step loop carrying a bloated 10k-token history burns 200k input tokens for one task. The levers:</p>
<ul>
<li><strong>Trim context</strong> — summarize old turns, drop irrelevant tool results (context engineering is cost engineering).</li>
<li><strong>Prompt caching</strong> — providers discount reused prompt prefixes heavily; keep the stable part (system prompt, tools) identical and cacheable.</li>
<li><strong>Cap outputs</strong> — ask for terse answers when terse is enough.</li>
</ul>
<h3>Model routing: the right brain for the job</h3>
<pre><code>classify / extract / route      → small, fast, cheap model
draft prose, everyday coding    → mid-tier
plan multi-step work, hard bugs → frontier model
</code></pre>
<p>The standard production pattern is a <strong>router</strong>: a cheap model (or rules) triages each request and escalates only the hard ones. Teams routinely cut spend 5–10× this way with no quality loss users can detect.</p>
<h3>Latency: felt speed beats raw speed</h3>
<ul>
<li><strong>Stream tokens</strong> — first words in 300ms feel fast even if the answer takes 8s.</li>
<li><strong>Parallelize independent steps</strong> — three tool calls at once, not in sequence (same lesson as Promise.all).</li>
<li><strong>Cache repeated answers</strong> — FAQ-shaped traffic shouldn't hit the model twice.</li>
</ul>
<div class="callout">💡 <span>Track <strong>cost per completed task</strong>, not cost per call. A cheap model that fails and retries three times costs more than the expensive one that nails it first try.</span></div>`,
          takeaways: [
            "Agents resend context every step — trimming it is the biggest cost lever.",
            "Keep stable prompt prefixes identical to exploit prompt caching.",
            "Route: cheap models triage, frontier models handle the genuinely hard.",
            "Stream output and parallelize tools; measure cost per task, not per call.",
          ],
          quiz: [
            {
              q: "Why does a stable, identical system prompt across calls save money?",
              options: [
                "Shorter prompts are always better",
                "Providers cache repeated prompt prefixes and charge much less for them",
                "It doesn't — every token always costs the same",
                "The model memorizes it",
              ],
              answer: 1,
              explain: "Prompt caching discounts the unchanged prefix. Restructuring prompts as stable-part + variable-suffix is free money at scale.",
            },
            {
              q: "The classic cost-cutting architecture for mixed traffic is…",
              options: [
                "Always use the biggest model to avoid retries",
                "A router: cheap model handles easy requests, escalates hard ones",
                "Turn off logging",
                "Shorter user questions",
              ],
              answer: 1,
              explain: "Most traffic is easy. Triage-and-escalate keeps quality where it matters while most calls hit the cheap tier.",
            },
            {
              q: "Users complain the agent 'feels slow' though total time is fine. First fix?",
              options: [
                "A bigger GPU",
                "Stream the response so words appear immediately",
                "Remove the loading spinner",
                "Shorter answers",
              ],
              answer: 1,
              explain: "Perceived latency is time-to-first-token. Streaming turns an 8-second wait into an immediately-responding conversation.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.push("agents");
