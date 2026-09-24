/* 1991 Academy track: Deep Learning */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.tracks.dl = {
  id: "dl",
  title: "Deep Learning",
  tagline: "Neural networks from first principles — up to the transformer that powers modern AI.",
  icon: "🧠",
  accent: "#22d3ee",
  accentSoft: "rgba(34, 211, 238, 0.14)",
  modules: [
    {
      id: "dl-m1",
      title: "Neural Networks from Scratch",
      lessons: [
        {
          id: "dl-1-1",
          title: "Neurons, Layers & Activations",
          minutes: 12,
          videos: [
            { id: "aircAruvnKk", title: "But what is a neural network?", channel: "3Blue1Brown", length: "19 min" },
          ],
          content: `
<p>A neural network sounds biological and mysterious. It isn't. It's a stack of linear models with a twist — and the twist is everything.</p>
<h3>One neuron</h3>
<p>A neuron computes a weighted sum of inputs, then applies a nonlinear <strong>activation function</strong>:</p>
<pre><code>output = activation(w1·x1 + w2·x2 + ... + b)</code></pre>
<p>Sound familiar? Without the activation, it's exactly the linear model from ML. </p>
<h3>Why nonlinearity is the whole point</h3>
<p>Stack linear layers without activations and the result collapses into… one linear layer. (A composition of linear functions is linear.) The nonlinearity between layers is what lets networks bend, fold and carve decision boundaries of arbitrary shape.</p>
<pre><code>ReLU(z)    = max(0, z)      ← the modern default: cheap, effective
sigmoid(z) = 1/(1+e^(-z))   ← squashes to (0,1); used at output for probability
tanh(z)                     ← squashes to (-1,1)</code></pre>
<h3>From neuron to network</h3>
<p>Arrange neurons in <strong>layers</strong>: each layer's outputs feed the next layer's inputs. Early layers learn simple features; deeper layers compose them into abstractions:</p>
<pre><code>pixels → edges → textures → shapes → "cat"</code></pre>
<p>That hierarchy of learned features — rather than hand-engineered ones — is the "deep" in deep learning, and the reason it conquered vision, speech and language.</p>
<div class="callout">💡 <span>A network is just a big differentiable function with millions of knobs (weights). Training = turning the knobs to minimize loss — same loop you met in the ML track.</span></div>`,
          takeaways: [
            "A neuron = weighted sum + nonlinear activation.",
            "Without nonlinearities, any depth collapses to a single linear model.",
            "ReLU is the default activation; sigmoid squashes outputs to probabilities.",
            "Depth builds a hierarchy: simple features compose into abstract ones.",
          ],
          quiz: [
            {
              q: "What happens if you remove all activation functions from a 10-layer network?",
              options: [
                "It trains faster with the same power",
                "It becomes equivalent to a single linear layer",
                "It overfits more",
                "Nothing changes",
              ],
              answer: 1,
              explain: "Composing linear maps yields a linear map. The nonlinear activations are what give depth its expressive power.",
            },
            {
              q: "ReLU(-3) equals…",
              options: ["-3", "3", "0", "0.05"],
              answer: 2,
              explain: "ReLU(z) = max(0, z): negatives become 0, positives pass through unchanged.",
            },
            {
              q: "In an image classifier, the earliest layers typically learn…",
              options: [
                "Whole-object concepts like 'dog'",
                "Simple local patterns like edges and color blobs",
                "The output probabilities",
                "Nothing — only the last layer learns",
              ],
              answer: 1,
              explain: "Features grow in abstraction with depth: edges → textures → parts → objects. Early layers capture the primitives.",
            },
          ],
        },
        {
          id: "dl-1-2",
          title: "Backpropagation, Demystified",
          minutes: 14,
          videos: [
            { id: "Ilg3gGewQ5U", title: "What is backpropagation really doing?", channel: "3Blue1Brown", length: "13 min" },
          ],
          content: `
<p>Backpropagation has a scary reputation, but it's just the chain rule from calculus, applied systematically — and it's the engine behind every trained network.</p>
<h3>The problem</h3>
<p>Gradient descent needs to know: <em>if I nudge this weight, how does the loss change?</em> — for millions of weights. Computing each one from scratch would be astronomically wasteful.</p>
<h3>The insight: reuse shared work</h3>
<p>A network is a chain of functions. The chain rule says the derivative through a chain is the <em>product</em> of local derivatives:</p>
<pre><code>x → [layer1] → h → [layer2] → prediction → [loss]

d(loss)/d(w1) = d(loss)/d(pred) · d(pred)/d(h) · d(h)/d(w1)</code></pre>
<p>Notice that <code>d(loss)/d(pred)</code> is needed by <em>every</em> weight, and <code>d(pred)/d(h)</code> by every weight in earlier layers. So compute once, sweeping <strong>backward</strong> from the loss, reusing partial results layer by layer. That's backprop: dynamic programming over derivatives.</p>
<h3>The training loop, complete</h3>
<pre><code>for each batch:
  1. forward pass:  run inputs through, save intermediate values
  2. compute loss:  compare predictions with labels
  3. backward pass: chain rule from loss back to every weight
  4. update:        weight -= lr * gradient</code></pre>
<div class="callout">💡 <span>Frameworks like PyTorch do this automatically (<strong>autograd</strong>): they record the forward computation as a graph, then walk it backward. You write step 1; steps 3–4 are <code>loss.backward()</code> and <code>optimizer.step()</code>.</span></div>
<p>Vanishing gradients — products of many small derivatives shrinking to nothing in deep networks — plagued early deep learning. ReLU, smart initialization and normalization layers are largely fixes for exactly this.</p>`,
          takeaways: [
            "Backprop = chain rule + reusing shared partial derivatives, backward from the loss.",
            "Forward pass saves intermediates; backward pass turns them into gradients.",
            "Autograd frameworks automate it: loss.backward(), optimizer.step().",
            "Vanishing gradients motivated ReLU, initialization schemes and normalization.",
          ],
          exercises: [
            {
              type: "order",
              title: "One training step, in order",
              prompt: "Arrange what happens inside the loop for every batch.",
              lines: [
                "sample a mini-batch of examples",
                "forward pass: compute predictions (save intermediates)",
                "compute the loss against the labels",
                "backward pass: chain-rule gradients from loss to every weight",
                "optimizer step: nudge weights against their gradients",
              ],
            },
          ],
          quiz: [
            {
              q: "Backpropagation is fundamentally…",
              options: [
                "A biological simulation of neurons",
                "The chain rule applied efficiently by reusing shared derivatives backward through the network",
                "A way to initialize weights",
                "A regularization method",
              ],
              answer: 1,
              explain: "It's calculus plus dynamic programming: compute d(loss)/d(w) for all weights in one backward sweep instead of separately.",
            },
            {
              q: "Why does the forward pass save intermediate activations?",
              options: [
                "For debugging only",
                "The backward pass needs them to compute local derivatives",
                "To display progress bars",
                "It doesn't — they're discarded",
              ],
              answer: 1,
              explain: "Local gradients depend on the values that flowed through. No saved activations → nothing to differentiate through.",
            },
            {
              q: "The 'vanishing gradient' problem means…",
              options: [
                "Gradients are deleted by the optimizer",
                "Products of many small derivatives shrink toward zero, so early layers barely learn",
                "The loss becomes negative",
                "Learning rates decay too fast",
              ],
              answer: 1,
              explain: "In deep chains, multiplying many values < 1 drives the signal to ~0 by the early layers — they stop receiving learning signal.",
            },
          ],
        },
        {
          id: "dl-1-3",
          title: "Training Dynamics: Making Networks Actually Learn",
          minutes: 13,
          content: `
<p>Between "network defined" and "network trained well" lies a set of practical knobs. Knowing them separates frustration from progress.</p>
<h3>Optimizers</h3>
<p>Plain SGD steps directly along the gradient. Modern variants adapt:</p>
<ul>
<li><strong>SGD + momentum</strong> — accumulate velocity, roll through small bumps.</li>
<li><strong>Adam / AdamW</strong> — per-weight adaptive step sizes. The default choice: robust, fast to get working.</li>
</ul>
<h3>The learning rate rules everything</h3>
<pre><code>too high  → loss explodes or oscillates
too low   → training crawls, gets stuck
just right→ smooth, steady descent

practical: start ~3e-4 with Adam, use a schedule
(warmup, then decay) for serious runs</code></pre>
<h3>Batches</h3>
<p>Computing loss over the whole dataset per step is slow; one sample is noisy. <strong>Mini-batches</strong> (32–512 samples) balance both, and GPUs love the parallelism.</p>
<h3>Stabilizers and regularizers</h3>
<ul>
<li><strong>Normalization</strong> (BatchNorm, LayerNorm) — keeps activations in healthy ranges; makes deep nets dramatically easier to train.</li>
<li><strong>Dropout</strong> — randomly zero some activations during training so no single pathway becomes indispensable.</li>
<li><strong>Data augmentation</strong> — flips, crops, noise: free extra data and stronger generalization.</li>
<li><strong>Early stopping</strong> — watch validation loss, keep the best checkpoint.</li>
</ul>
<div class="callout">💡 <span>Debugging ritual that saves careers: first <strong>overfit a tiny subset</strong> (10 samples) to ~zero loss. If you can't, the bug is in your code, not your hyperparameters.</span></div>`,
          takeaways: [
            "Adam/AdamW is the sane default optimizer; learning rate is still the key knob.",
            "Mini-batches balance gradient quality against speed.",
            "Normalization layers stabilize; dropout and augmentation regularize.",
            "Sanity check: overfit 10 samples first — if you can't, fix the code.",
          ],
          quiz: [
            {
              q: "Your brand-new model can't even overfit 10 training samples. Most likely cause?",
              options: [
                "Not enough regularization",
                "A bug in the code or data pipeline",
                "The test set is too hard",
                "Batch size is too large",
              ],
              answer: 1,
              explain: "Any healthy network can memorize 10 samples. Failure there points to broken labels, wrong loss, or a wiring bug — not tuning.",
            },
            {
              q: "What does dropout do during training?",
              options: [
                "Deletes the worst neurons permanently",
                "Randomly zeroes activations so the network can't rely on any single pathway",
                "Reduces the dataset size",
                "Lowers the learning rate over time",
              ],
              answer: 1,
              explain: "Random deactivation forces redundant, distributed representations — a strong regularizer. At inference it's turned off.",
            },
            {
              q: "Why mini-batches instead of the full dataset per gradient step?",
              options: [
                "Full-dataset gradients are illegal in PyTorch",
                "Mini-batches give frequent, cheap, good-enough gradient estimates and exploit GPU parallelism",
                "Small batches always generalize worse",
                "To use more memory",
              ],
              answer: 1,
              explain: "A batch gradient is a noisy but unbiased estimate of the true gradient — you trade a little accuracy for many more updates per hour.",
            },
          ],
        },
      ],
    },
    {
      id: "dl-m2",
      title: "Architectures That Changed Everything",
      lessons: [
        {
          id: "dl-2-1",
          title: "CNNs: How Machines See",
          minutes: 12,
          content: `
<p>Feed a 1-megapixel image into a fully-connected layer and you need millions of weights per neuron — and a cat in the top-left teaches the network nothing about cats in the bottom-right. Convolutions fix both problems with one idea.</p>
<h3>The convolution</h3>
<p>Slide a small filter (say 3×3 weights) across the image, computing a dot product at each position. The output — a <strong>feature map</strong> — lights up wherever the pattern appears:</p>
<pre><code>filter (learned):        detects:
[-1  0  +1]
[-2  0  +2]              vertical edges
[-1  0  +1]</code></pre>
<p>Two superpowers follow:</p>
<ul>
<li><strong>Parameter sharing</strong> — the same 9 weights scan the whole image: thousands of times fewer parameters.</li>
<li><strong>Translation equivariance</strong> — a pattern is detected wherever it appears. Learn "cat ear" once, find it anywhere.</li>
</ul>
<h3>The classic recipe</h3>
<pre><code>[conv → ReLU → pool] × N  →  flatten  →  dense  →  classes</code></pre>
<p><strong>Pooling</strong> (taking the max over small windows) shrinks the maps, adds robustness to small shifts, and grows the receptive field so deeper filters see larger structures. Stacked stages learn edges → textures → parts → objects.</p>
<div class="callout">💡 <span>CNNs won ImageNet in 2012 (AlexNet) and kicked off the deep-learning era. The core idea — <strong>exploit the structure of your data</strong> (locality, translation) — echoes in every architecture since.</span></div>`,
          takeaways: [
            "Convolutions slide small learned filters across the image, sharing weights.",
            "Feature maps show where each pattern occurs — translation equivariance for free.",
            "Pooling adds shift-robustness and expands what deeper layers can see.",
            "The meta-lesson: encode your data's structure into the architecture.",
          ],
          quiz: [
            {
              q: "Why do CNNs need far fewer parameters than fully-connected nets on images?",
              options: [
                "Images are compressed first",
                "One small filter's weights are reused at every image position",
                "They use fewer layers",
                "They only look at grayscale",
              ],
              answer: 1,
              explain: "Parameter sharing: a 3×3 filter (9 weights) scans the entire image instead of every pixel having its own weight.",
            },
            {
              q: "Max pooling primarily provides…",
              options: [
                "More parameters",
                "Downsampling plus robustness to small translations",
                "Color normalization",
                "A larger output image",
              ],
              answer: 1,
              explain: "Taking the max over a window keeps the strongest activation regardless of tiny shifts, while halving resolution.",
            },
          ],
        },
        {
          id: "dl-2-2",
          title: "Attention & the Transformer",
          minutes: 15,
          videos: [
            { id: "wjZofJX0v4M", title: "But what is a GPT? Visual intro to transformers", channel: "3Blue1Brown", length: "27 min" },
            { id: "eMlx5fFNoYc", title: "Attention in transformers, visually explained", channel: "3Blue1Brown", length: "26 min" },
            { id: "kCc8FmEb1nY", title: "Let's build GPT: from scratch, in code", channel: "Andrej Karpathy", length: "2 h" },
          ],
          content: `
<p>Before 2017, sequence models read text word-by-word, squeezing everything through a bottleneck memory. The transformer replaced that with a single question every word asks: <em>"which other words matter to me?"</em></p>
<h3>Self-attention in one pass</h3>
<p>Each token produces three vectors — <strong>query</strong> (what I'm looking for), <strong>key</strong> (what I contain), <strong>value</strong> (what I offer):</p>
<pre><code>scores    = Q · Kᵀ / √d        # every token scores every other token
weights   = softmax(scores)     # normalize to attention weights
output    = weights · V         # each token = weighted mix of all values</code></pre>
<p>In "The animal didn't cross the street because <strong>it</strong> was tired", the token <em>it</em> learns to attend strongly to <em>animal</em>. No recurrence, no bottleneck — and every token computes this <strong>in parallel</strong>, which is why GPUs and transformers are a match made in heaven.</p>
<h3>The full block</h3>
<pre><code>[multi-head attention → add &amp; norm → feed-forward → add &amp; norm] × N</code></pre>
<ul>
<li><strong>Multi-head</strong>: several attentions run side by side, each free to track a different relationship (syntax, coreference, position…).</li>
<li><strong>Positional encoding</strong>: attention itself ignores order, so position information is added to the embeddings.</li>
<li><strong>Residual connections + norm</strong>: the gradient highway that lets us stack dozens of layers.</li>
</ul>
<h3>Why this architecture ate the world</h3>
<p>GPT-style models are transformers trained on a task of almost embarrassing simplicity — <strong>predict the next token</strong> — at colossal scale. It turns out that predicting text well enough forces a model to absorb grammar, facts, and reasoning patterns. Vision (ViT), audio, code and protein models all ride the same architecture.</p>
<div class="callout">💡 <span>Attention's price: cost grows with the <strong>square</strong> of sequence length — every token looks at every token. Long-context research is largely a battle against this O(n²).</span></div>`,
          takeaways: [
            "Self-attention: each token gathers a weighted mix of all others via query/key/value.",
            "Full parallelism across tokens is why transformers scale on GPUs.",
            "Multi-head = several relationship-trackers; positions must be injected explicitly.",
            "LLMs = transformers + next-token prediction + massive scale.",
          ],
          quiz: [
            {
              q: "In self-attention, what does the query/key dot product compute?",
              options: [
                "The final output probabilities",
                "How relevant each other token is to the current token",
                "The position of each word",
                "The learning rate",
              ],
              answer: 1,
              explain: "Q·K scores relevance between token pairs; softmax turns scores into weights used to mix the value vectors.",
            },
            {
              q: "Why do transformers need positional encodings?",
              options: [
                "To reduce parameters",
                "Attention is order-blind — without positions, 'dog bites man' equals 'man bites dog'",
                "To speed up training",
                "They don't; it's optional decoration",
              ],
              answer: 1,
              explain: "Attention is a set operation over tokens. Position vectors restore word-order information the model would otherwise lack.",
            },
            {
              q: "The main computational weakness of vanilla attention is…",
              options: [
                "It can't run on GPUs",
                "Cost scales quadratically with sequence length",
                "It only works on English",
                "It can't be stacked in layers",
              ],
              answer: 1,
              explain: "Every token attends to every token: n² pairs. Doubling context length quadruples attention compute and memory.",
            },
          ],
        },
      ],
    },
    {
      id: "dl-m3",
      title: "Modern Practice",
      lessons: [
        {
          id: "dl-3-1",
          title: "Transfer Learning & Fine-Tuning",
          minutes: 13,
          content: `
<p>Nobody trains serious vision or language models from scratch anymore. The professional move is to start from a model that already learned the world — and bend it to your task.</p>
<h3>Why it works</h3>
<p>A network pretrained on millions of images already knows edges, textures, shapes and object parts (remember the feature hierarchy?). Those features transfer: your cat-vs-dog classifier needs the last mile, not the first thousand.</p>
<h3>The two modes</h3>
<pre><code>Feature extraction   freeze the backbone, train only a new head
                     → small data (hundreds of samples), fast, safe

Fine-tuning          unfreeze some/all layers, train with a SMALL lr
                     → more data, higher ceiling, easy to wreck</code></pre>
<h3>The recipe</h3>
<pre><code>model = load_pretrained("resnet50")     # or any modern backbone
freeze(model.backbone)                   # keep learned features
model.head = new_classifier(my_classes)  # your task's output layer
train(head_only, lr=1e-3)                # 1) train the head
unfreeze(model.backbone)
train(everything, lr=1e-5)               # 2) optionally fine-tune, gently</code></pre>
<p>The small learning rate in step 2 is the whole game: big steps bulldoze the pretrained features you came for (the dreaded <em>catastrophic forgetting</em>).</p>
<h3>The same idea runs the LLM world</h3>
<p>GPT-style models are pretrained once for millions of dollars, then adapted: full fine-tuning, or parameter-efficient methods like <strong>LoRA</strong> (train tiny low-rank adapter matrices, freeze everything else — a fine-tune that fits on one GPU).</p>
<div class="callout">💡 <span>Professional default: <strong>never start from random weights</strong> if a pretrained model exists for your modality. Hundreds of labeled examples + transfer learning routinely beats millions + from-scratch.</span></div>`,
          takeaways: [
            "Pretrained backbones already know generic features; reuse them.",
            "Small data → freeze backbone, train head. More data → fine-tune with tiny lr.",
            "Too-large fine-tuning lr causes catastrophic forgetting.",
            "LoRA = parameter-efficient fine-tuning for large models.",
          ],
          exercises: [
            {
              type: "blanks",
              title: "Complete the transfer-learning recipe",
              prompt: "Fill the blanks so the pretrained knowledge survives training.",
              code: "model = load_pretrained(\"resnet50\")\nfor layer in model.backbone:\n    layer.trainable = {{0}}      # protect learned features\nmodel.head = NewClassifier(num_classes={{1}})\ntrain(model, lr={{2}})           # gentle steps only",
              blanks: [
                { options: ["False", "True", "\"maybe\""], answer: 0 },
                { options: ["my_num_classes", "1000", "0"], answer: 0 },
                { options: ["1e-5 (small)", "1.0 (large)", "0"], answer: 0 },
              ],
            },
          ],
          quiz: [
            {
              q: "You have 400 labeled X-ray images. The professional approach is…",
              options: [
                "Train a CNN from scratch",
                "Freeze a pretrained backbone and train a new classification head",
                "Collect 1M images first",
                "Use a linear model on raw pixels",
              ],
              answer: 1,
              explain: "400 samples can't teach vision from scratch, but they can absolutely train a small head on top of transferred features.",
            },
            {
              q: "Why use a much smaller learning rate when fine-tuning than when training a fresh head?",
              options: [
                "It saves electricity",
                "Large updates overwrite the pretrained features you're trying to reuse",
                "Small lr trains faster",
                "Frameworks require it",
              ],
              answer: 1,
              explain: "The pretrained weights are the asset. Gentle steps adapt them; big steps bulldoze them — catastrophic forgetting.",
            },
            {
              q: "LoRA makes fine-tuning huge models cheap by…",
              options: [
                "Deleting most of the model",
                "Training only small low-rank adapter matrices while freezing the original weights",
                "Using lower screen resolution",
                "Quantizing the dataset",
              ],
              answer: 1,
              explain: "Instead of updating billions of weights, LoRA learns tiny additive matrices — a fraction of the parameters, most of the benefit.",
            },
          ],
        },
        {
          id: "dl-3-2",
          title: "Embeddings: the Universal Representation",
          minutes: 13,
          content: `
<p>If deep learning has one export that touches everything — search, recommendations, RAG, clustering, moderation — it's the <strong>embedding</strong>: meaning as a vector.</p>
<h3>The idea</h3>
<p>An embedding model maps things (words, sentences, images, songs, users) to points in a high-dimensional space where <strong>distance = dissimilarity</strong>. "How do I reset my password?" and "Forgot my login credentials" land close together despite sharing zero words.</p>
<h3>Where the magic showed up first</h3>
<p>Word2vec (2013) learned word vectors from raw text and produced the famous arithmetic:</p>
<pre><code>vec("king") - vec("man") + vec("woman") ≈ vec("queen")</code></pre>
<p>Directions in the space encode <em>relations</em>. Modern sentence embedders (trained with contrastive learning: pull similar pairs together, push different ones apart) do this for whole passages.</p>
<h3>The universal workflow</h3>
<pre><code>embed everything once  → store vectors in an index
embed the query        → find nearest neighbors (cosine similarity)
                       → that's search, recommendation, dedup, RAG…</code></pre>
<p>You've already met this twice: the recommender mission (cosine top-k) and the RAG lesson in the Agents track — embeddings are the connective tissue between the tracks.</p>
<h3>Practical notes</h3>
<ul>
<li><strong>Cosine similarity</strong> is the standard metric; normalize your vectors.</li>
<li>At scale, exact search is too slow → <strong>approximate nearest neighbor</strong> indexes (HNSW) trade a sliver of recall for 100× speed. Vector databases are managed wrappers around exactly this.</li>
<li>Embeddings are learned opinions: a model trained on code ranks code similarity better than a general one. Pick the embedder for your domain.</li>
</ul>
<div class="callout">💡 <span>Interview-ready framing: embeddings turn "understanding" into <strong>geometry</strong> — and geometry is something computers search brilliantly.</span></div>`,
          takeaways: [
            "Embeddings map anything to vectors where distance ≈ semantic difference.",
            "Directions encode relations (king − man + woman ≈ queen).",
            "Embed-once + nearest-neighbor search powers search, recsys and RAG alike.",
            "ANN indexes (HNSW) make similarity search fast at scale.",
          ],
          quiz: [
            {
              q: "Two texts share no words but mean the same thing. Their embeddings will be…",
              options: [
                "Orthogonal",
                "Close together — embedders are trained on meaning, not word overlap",
                "Identical",
                "Random",
              ],
              answer: 1,
              explain: "That's the entire point: semantic similarity becomes spatial proximity, which keyword matching can never capture.",
            },
            {
              q: "Why do vector databases use approximate (not exact) nearest-neighbor search?",
              options: [
                "Exact answers are illegal",
                "Exact search over millions of high-dimensional vectors is too slow; ANN trades tiny recall loss for huge speed",
                "Approximate results are more accurate",
                "To save disk space only",
              ],
              answer: 1,
              explain: "Comparing a query against every stored vector is O(n·d). HNSW-style indexes answer in milliseconds with ~99% recall.",
            },
            {
              q: "Which 1991 Academy pieces are both 'embeddings + nearest neighbors' underneath?",
              options: [
                "The XP system and the streak",
                "The recommender mission and RAG retrieval",
                "Quizzes and toasts",
                "Dark mode and light mode",
              ],
              answer: 1,
              explain: "Recommendation = user vector vs item vectors; RAG = query vector vs document vectors. Same geometry, different nouns.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.push("dl");
