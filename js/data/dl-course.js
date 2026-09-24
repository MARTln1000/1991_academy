/* 1991 Academy — FAST "Deep Learning" course integration (V. Mikayelyan).
   Restructures the DL track: ONE LESSON PER LECTURE (18 lectures), each with
   its slide deck and, where the course assigned one, its homework PDF, driver
   notebook, dataset and solution notebook (assets/courses/dl). Existing
   proven lessons slot in where they match a lecture; "Beyond the Course"
   keeps the rest. No lecture videos yet — Martin will provide the playlist. */
(function () {
  const track = window.MARTINIUM.tracks.dl;
  if (!track) return;
  const byId = {};
  for (const m of track.modules) for (const l of m.lessons) byId[l.id] = l;

  const A = "../assets/courses/dl/";
  const S = A + "Slides/";
  const HP = A + "Homeworks/Problems/";
  const HJ = A + "Homeworks/Homework Jupiter/";
  const HS = A + "Homeworks/Solutions/";

  function augment(id, materials) {
    if (byId[id]) byId[id].materials = materials;
  }

  /* ---------- materials for the kept lessons ---------- */

  augment("dl-1-1", [ /* Lecture 2 */
    { label: "Slides: L2 — Intro to NNs, Linear Regression", href: S + "Lecture2_Intro_to_NNs_Linear_Regression.pdf" },
    { label: "Homework 1 (PDF)", href: HP + "DLHomework1.pdf" },
    { label: "HW1 driver notebook", href: HJ + "HW 1.ipynb" },
    { label: "HW1 solution notebook", href: HS + "Homework1_solution.ipynb" },
  ]);

  augment("dl-1-2", [ /* Lecture 4 */
    { label: "Slides: L4 — SGD, Backpropagation, Normalization", href: S + "Lecture4, SGD, Backpropogation, Data Normalization.pdf" },
    { label: "Homework 2 (PDF)", href: HP + "DLHomework2.pdf" },
    { label: "HW2 solution notebook", href: HS + "Homework2_solution.ipynb" },
  ]);

  augment("dl-1-3", [ /* Lecture 6 */
    { label: "Slides: L6 — BatchNorm, ADAM, Augmentation", href: S + "Lecture6, Moving Average, Batch Normalization, ADAM, Data Augmentation.pdf" },
  ]);

  augment("dl-2-1", [ /* Lecture 7 */
    { label: "Slides: L7 — Introduction to CNNs", href: S + "Lecture7, Introduction to CNNs.pdf" },
  ]);

  augment("dl-2-2", [ /* Lecture 14 */
    { label: "Slides: L14 — Transformer", href: S + "Lecture14, Transformer.pdf" },
    { label: "Homework 6 (PDF)", href: HP + "DLHomework6.pdf" },
  ]);

  augment("dl-3-1", [ /* Lecture 10 */
    { label: "Slides: L10 — Inceptions, MobileNet, Transfer Learning", href: S + "Lecture10, Inceptions, MobileNet, Transfer Learning.pdf" },
  ]);

  /* ---------- new lecture lessons ---------- */

  const lec1 = {
    id: "dl-lec1",
    title: "Welcome to Deep Learning",
    minutes: 8,
    materials: [{ label: "Slides: L1 — Course Introduction", href: S + "Lecture1.pdf" }],
    content: `
<p>The opening lecture sets the frame for everything that follows: deep learning is <strong>supervised learning with neural networks as the function family</strong>.</p>
<h3>The supervised recipe, one more time</h3>
<pre><code>data (x, y) → model f(x; θ) → loss(f(x), y) → adjust θ</code></pre>
<p>You've seen this loop in the ML track. What changes here is only the middle box: instead of a line, a tree or an SVM, <code>f</code> is a <strong>neural network</strong> — a stack of linear maps and nonlinearities that can approximate essentially any function if made wide/deep enough (the universal approximation theorem, stated in this lecture).</p>
<h3>Why now, why deep?</h3>
<p>Three ingredients matured together: big labeled datasets, GPUs that multiply matrices absurdly fast, and architectural/optimization tricks (the subject of lectures 4–6). The course walks exactly that arc: train small nets by hand → tame training → convolutions → sequences → transformers → generative models.</p>
<div class="callout">💡 <span>Everything in this track compounds: the math track's gradients, the ML track's train/test discipline, and the Lab's from-scratch builds all reappear here at scale.</span></div>`,
    takeaways: [
      "Deep learning = supervised learning where the model family is neural networks.",
      "Universal approximation: big enough nets can represent essentially any function.",
      "Data + GPUs + training tricks together made depth practical.",
    ],
    quiz: [
      {
        q: "In the supervised-learning recipe, what does deep learning replace compared to classical ML?",
        options: [
          "The dataset",
          "The model family — neural networks instead of lines/trees/SVMs; the loss-and-update loop stays the same",
          "The need for labels",
          "The evaluation metrics",
        ],
        answer: 1,
        explain: "The train/test discipline, losses and gradient descent carry over; only the function family f(x; θ) changes.",
      },
      {
        q: "The universal approximation theorem says roughly that…",
        options: [
          "Any network trains successfully",
          "A sufficiently large network CAN represent (approximate) any reasonable function — saying nothing about finding it by training",
          "Deep nets never overfit",
          "One neuron is enough",
        ],
        answer: 1,
        explain: "It's an existence statement about capacity, not a guarantee that gradient descent finds the approximation.",
      },
    ],
  };

  const lec3 = {
    id: "dl-lec3",
    title: "Logistic Regression & the Softmax Classifier",
    minutes: 13,
    materials: [
      { label: "Slides: L3 — Logistic Regression, Softmax", href: S + "Lecture3, Logistic Regression, Softmax Classifier.pdf" },
      { label: "Homework 3 (PDF): heart disease", href: HP + "DLHomework3.pdf" },
      { label: "HW3 driver notebook", href: HJ + "HW_3.ipynb" },
      { label: "Dataset: heart.csv", href: HJ + "heart.csv" },
      { label: "HW3 solution notebook", href: HS + "Homework3_solution.ipynb" },
    ],
    content: `
<p>Before convolutions and transformers, the humble output layer: how a network turns numbers into <em>probabilities</em>, and which loss makes those probabilities honest.</p>
<h3>Two classes: sigmoid</h3>
<p>Squash a score z into (0,1): <code>σ(z) = 1/(1+e^−z)</code>. That's logistic regression — a one-neuron network.</p>
<h3>Many classes: softmax</h3>
<pre><code>softmax(z)ᵢ = e^zᵢ / Σⱼ e^zⱼ</code></pre>
<p>Exponentiate every class score, normalize — you get a probability distribution (positive, sums to 1). The largest score wins, but the runner-ups keep honest mass.</p>
<h3>The right loss: cross-entropy</h3>
<p>MSE on probabilities trains terribly — its gradients vanish exactly when the model is confidently wrong. <strong>Cross-entropy</strong>, <code>−log p(correct class)</code>, punishes confident mistakes brutally and pairs with sigmoid/softmax to give clean gradients (the −log of a near-zero probability is huge). Every classifier you'll train in this course ends in softmax + cross-entropy.</p>
<div class="callout">💡 <span>HW3 makes it concrete: predict heart disease from heart.csv with logistic regression, then beat it with a small network. The solution notebook is attached — struggle first.</span></div>`,
    takeaways: [
      "Sigmoid handles binary outputs; softmax generalizes to many classes.",
      "Softmax = exponentiate + normalize → a proper probability distribution.",
      "Use cross-entropy, not MSE, for classification: confident mistakes get huge gradients.",
    ],
    quiz: [
      {
        q: "Softmax outputs always…",
        options: [
          "Sum to 1 and are positive — a probability distribution over classes",
          "Contain exactly one 1 and zeros",
          "Are between −1 and 1",
          "Equal the input scores",
        ],
        answer: 0,
        explain: "Exponentiation makes them positive; the normalization makes them sum to 1.",
      },
      {
        q: "Why cross-entropy instead of MSE for classification?",
        options: [
          "It's faster to compute",
          "MSE's gradients vanish on confident wrong answers; −log p punishes them hard and keeps gradients healthy",
          "MSE only works in 1D",
          "Tradition",
        ],
        answer: 1,
        explain: "With sigmoid/softmax outputs, cross-entropy yields the clean (p − y) gradient — no vanishing on confident errors.",
      },
    ],
  };

  const lec5 = {
    id: "dl-lec5",
    title: "Random Initialization & Dropout",
    minutes: 12,
    materials: [{ label: "Slides: L5 — Random Initialization, Dropout", href: S + "Lecture5, Random Initialization, Dropout.pdf" }],
    content: `
<p>Two deceptively small decisions that decide whether a deep net trains at all.</p>
<h3>Why not initialize with zeros?</h3>
<p><strong>Symmetry.</strong> If every weight starts equal, every neuron in a layer computes the same thing, receives the same gradient, and stays identical forever — your 512-neuron layer is secretly one neuron. Random initialization breaks the symmetry.</p>
<h3>Why not just any random numbers?</h3>
<p>Scale matters: too large and activations/gradients explode through the layers; too small and they shrink to nothing (the vanishing story again). The fix is variance-matched schemes — <strong>Xavier/Glorot</strong> (for tanh/sigmoid) and <strong>He</strong> (for ReLU) — which scale each layer's weights by ~1/√(fan-in) so signal variance stays constant with depth.</p>
<h3>Dropout, properly understood</h3>
<p>During training, zero each activation with probability p. Effects: no neuron can rely on a specific partner (co-adaptation breaks), and you're implicitly training an <em>ensemble</em> of thinned networks. At inference dropout turns <strong>off</strong> and activations are rescaled so expectations match. It's the regularizer you reach for when a big net overfits a modest dataset.</p>
<div class="callout">💡 <span>Modern frameworks default to He/Xavier — which is exactly why beginners never see the disasters this lecture demonstrates. Know what the defaults are saving you from.</span></div>`,
    takeaways: [
      "Zero init = symmetry = a layer of clones that never differentiate.",
      "Xavier/He initialization keeps activation variance stable across depth.",
      "Dropout trains an implicit ensemble; it's disabled (and rescaled) at inference.",
    ],
    quiz: [
      {
        q: "What goes wrong if all weights start at the same value?",
        options: [
          "Nothing — training fixes it",
          "Neurons in a layer stay identical forever: same output, same gradient, same update",
          "The loss becomes negative",
          "Only the bias learns",
        ],
        answer: 1,
        explain: "Identical neurons receive identical gradients, so the symmetry never breaks — random init exists to break it.",
      },
      {
        q: "At inference time, dropout…",
        options: [
          "Keeps dropping neurons randomly",
          "Is turned off (with rescaling so expected activations match training)",
          "Drops entire layers",
          "Becomes batch normalization",
        ],
        answer: 1,
        explain: "Randomness at test time would make predictions non-deterministic; instead the full net runs with matched expectations.",
      },
    ],
  };

  const lec8 = {
    id: "dl-lec8",
    title: "LeNet, AlexNet & VGG",
    minutes: 13,
    materials: [
      { label: "Slides: L8 — LeNet, AlexNet, VGG", href: S + "Lecture8, LeNet, AlexNet, VGG.pdf" },
      { label: "Homework 4 (PDF): VGG on CIFAR-100", href: HP + "DLHomework4.pdf" },
      { label: "HW4 driver notebook", href: HJ + "HW_4.ipynb" },
      { label: "HW4 solution notebook", href: HS + "Homework4_solution.ipynb" },
    ],
    content: `
<p>Three architectures, three eras of the same idea.</p>
<ul>
<li><strong>LeNet-5 (1998)</strong> — the proof of concept: conv → pool → conv → pool → dense, reading handwritten digits for banks. ~60k parameters.</li>
<li><strong>AlexNet (2012)</strong> — the detonation: the same recipe scaled onto GPUs with ReLU and dropout, halving the ImageNet error overnight and starting the deep-learning era. ~60M parameters.</li>
<li><strong>VGG (2014)</strong> — the simplification: only 3×3 convolutions, stacked deep (16–19 layers). Two stacked 3×3 convs see a 5×5 window with fewer parameters and an extra nonlinearity; three see 7×7. Depth of simple blocks beats cleverness of big kernels.</li>
</ul>
<p>VGG's lesson — <em>uniform small blocks, repeated</em> — became the design language of everything after it. Its weakness: brutal parameter count (~138M, mostly in the dense layers), which is exactly what the next lecture's architectures attack.</p>
<div class="callout">💡 <span>HW4 has you train a VGG-style net on CIFAR-100 <em>without batch norm</em>, then add it — feeling on your own GPU-hours why Lecture 6's tricks exist. Solution notebook attached.</span></div>`,
    takeaways: [
      "LeNet proved convolution works; AlexNet scaled it on GPUs and started the era.",
      "VGG: stacks of 3×3 convs — same receptive field as big kernels, fewer params, more nonlinearity.",
      "Uniform repeated blocks became the standard design language; dense layers made VGG heavy.",
    ],
    quiz: [
      {
        q: "Why do two stacked 3×3 convolutions beat one 5×5?",
        options: [
          "They don't",
          "Same effective receptive field with fewer parameters and an extra nonlinearity between them",
          "They run on CPUs",
          "They need no padding",
        ],
        answer: 1,
        explain: "2×(3·3)=18 weights per channel-pair vs 25, plus a ReLU in between — more expressive AND cheaper. VGG's whole thesis.",
      },
      {
        q: "AlexNet's historic significance is that it…",
        options: [
          "Invented convolution",
          "Crushed ImageNet 2012 with a GPU-trained CNN, launching the modern deep-learning era",
          "Was the first network without weights",
          "Introduced transformers",
        ],
        answer: 1,
        explain: "Its ~10-point error drop on ImageNet convinced the field almost overnight that scaled CNNs were the way forward.",
      },
    ],
  };

  const lec9 = {
    id: "dl-lec9",
    title: "ResNet & Inception",
    minutes: 13,
    materials: [{ label: "Slides: L9 — ResNet, Inception v1", href: S + "Lecture9, ResNet, Inception v1.pdf" }],
    content: `
<p>After VGG, deeper kept winning — until it didn't: past ~20 layers, adding depth made even <em>training</em> error worse. Two architectures solved depth from different angles.</p>
<h3>ResNet: learn the residual</h3>
<p>Give each block a shortcut: <code>output = F(x) + x</code>. The block only learns the <strong>residual</strong> — the change to make — and the identity path gives gradients an unobstructed highway to early layers. Suddenly 152 layers train better than 20. Skip connections became universal; the transformer's "add &amp; norm" is the same idea.</p>
<h3>Inception: parallel multi-scale</h3>
<p>Why choose a kernel size? An Inception module runs 1×1, 3×3, 5×5 convolutions and pooling <em>in parallel</em> and concatenates the results. The trick that makes it affordable: <strong>1×1 convolutions</strong> as bottlenecks — mixing channels and shrinking their number before the expensive kernels, at negligible cost.</p>
<div class="callout">💡 <span>Two design moves to keep forever: <em>give gradients a highway</em> (ResNet) and <em>1×1 convs are cheap channel-mixers</em> (Inception). You'll see both in every modern network.</span></div>`,
    takeaways: [
      "Very deep plain nets degrade; residual shortcuts (F(x)+x) fix the gradient flow.",
      "ResNet blocks learn changes to the identity, not whole transformations.",
      "Inception runs multiple kernel sizes in parallel; 1×1 convs keep it cheap.",
    ],
    quiz: [
      {
        q: "The core problem ResNet's skip connections solve is…",
        options: [
          "Overfitting on small data",
          "Degradation in very deep nets: gradients/identity information couldn't flow through many layers",
          "Slow GPUs",
          "Large images",
        ],
        answer: 1,
        explain: "The identity path lets gradients reach early layers untouched, so 100+ layer networks finally train.",
      },
      {
        q: "In Inception modules, 1×1 convolutions are used mainly to…",
        options: [
          "Blur the image",
          "Reduce the channel count cheaply before expensive larger kernels (bottlenecks)",
          "Replace pooling",
          "Add positional encoding",
        ],
        answer: 1,
        explain: "A 1×1 conv is a per-pixel linear map across channels — a nearly-free dimensionality reducer.",
      },
    ],
  };

  const lec11 = {
    id: "dl-lec11",
    title: "Multitask Learning & Classification Metrics",
    minutes: 12,
    materials: [{ label: "Slides: L11 — Multitask Learning, Metrics", href: S + "Lecture11, Multitask Learning, Classification Metrics.pdf" }],
    content: `
<p>Two practical topics that turn a model into a product.</p>
<h3>Multitask learning: one trunk, many heads</h3>
<p>A self-driving perception net doesn't train separate networks for pedestrians, signs and lanes — it shares a feature-extracting <strong>trunk</strong> and branches into per-task <strong>heads</strong>, summing the losses (usually weighted). Sharing helps when tasks are related and data per task is limited: each task acts as a regularizer for the others. It hurts when tasks compete — watch for one loss dominating.</p>
<h3>Metrics, revisited at scale</h3>
<p>The ML track's precision/recall/F1 story returns, now with softmax confidences: thresholds, per-class metrics on imbalanced many-class problems, confusion matrices you can actually read, and top-k accuracy (ImageNet's top-5 exists because 1000 fine-grained classes make top-1 harsh). The discipline is unchanged: <em>pick the metric that prices your errors correctly before training anything</em>.</p>
<div class="callout">💡 <span>Multitask heads also enable auxiliary losses — cheap extra supervision (e.g. predicting rotation) that improves the shared features even if you never use that head in production.</span></div>`,
    takeaways: [
      "Multitask: shared trunk + task heads + summed (weighted) losses.",
      "Related tasks regularize each other; competing tasks need loss balancing.",
      "Metrics discipline carries over: thresholds, per-class views, top-k for many classes.",
    ],
    quiz: [
      {
        q: "In a multitask network, the shared trunk…",
        options: [
          "Computes the final predictions for all tasks",
          "Learns features useful to every task, while separate heads specialize",
          "Stores the datasets",
          "Only backpropagates one task's loss",
        ],
        answer: 1,
        explain: "The trunk gets gradient from all heads — each task shapes (and regularizes) the shared representation.",
      },
      {
        q: "ImageNet reports top-5 accuracy because…",
        options: [
          "Top-1 is impossible to compute",
          "With 1000 fine-grained classes, counting a prediction correct if the true class is in the 5 most confident is a fairer measure",
          "Only 5 classes matter",
          "It hides errors",
        ],
        answer: 1,
        explain: "Many ImageNet classes are near-duplicates (dog breeds); top-k acknowledges honest ambiguity.",
      },
    ],
  };

  const lec12 = {
    id: "dl-lec12",
    title: "Introduction to RNNs",
    minutes: 13,
    materials: [{ label: "Slides: L12 — Introduction to RNNs", href: S + "Lecture12, Introduction to RNNs.pdf" }],
    content: `
<p>Images have fixed size; sentences, audio and time series don't. Recurrent networks process a sequence one step at a time, carrying a <strong>hidden state</strong> — a running summary of everything seen so far:</p>
<pre><code>hₜ = tanh(W_h · hₜ₋₁ + W_x · xₜ + b)     ← same weights every step
yₜ = W_y · hₜ</code></pre>
<p>One set of weights, applied at every position — the sequence version of a CNN's weight sharing. Depending on wiring you get sequence→label (sentiment), sequence→sequence (translation), or label→sequence (captioning).</p>
<h3>Training: backprop through time</h3>
<p>Unroll the recurrence into a deep chain (one "layer" per time step) and backpropagate through it. And there's the catch you can now predict: a 100-step sequence is effectively a 100-layer network, so gradients <strong>vanish or explode</strong> across time. Long-range dependencies — "the <em>cats</em> … <em>were</em>" agreement across 30 words — die in transit. Exploding gradients get clipped; vanishing ones need new architecture: gates, next lecture.</p>
<div class="callout">💡 <span>The hidden state is a bottleneck by design: the entire past must squeeze through one fixed-size vector. Attention (two lectures ahead) exists precisely to remove that bottleneck.</span></div>`,
    takeaways: [
      "RNNs share one set of weights across time; hₜ summarizes the past.",
      "Training = backprop through the unrolled sequence (BPTT).",
      "Long sequences make gradients vanish/explode — the motivation for gates and attention.",
    ],
    quiz: [
      {
        q: "The hidden state hₜ of an RNN is best described as…",
        options: [
          "The current input token",
          "A fixed-size running summary of everything the network has seen so far",
          "The output probability",
          "A copy of the weights",
        ],
        answer: 1,
        explain: "All past information the model wants to keep must be encoded into hₜ — that's both the power and the bottleneck.",
      },
      {
        q: "Why do plain RNNs struggle with long-range dependencies?",
        options: [
          "They run out of memory",
          "Backprop through many time steps multiplies many small factors — gradients vanish before reaching distant past steps",
          "The vocabulary is too large",
          "They can't be unrolled",
        ],
        answer: 1,
        explain: "An unrolled RNN is as deep as the sequence is long: the vanishing-gradient story, now along the time axis.",
      },
    ],
  };

  const lec13 = {
    id: "dl-lec13",
    title: "GRU, LSTM & Attention",
    minutes: 14,
    materials: [
      { label: "Slides: L13 — GRU, LSTM, Attention", href: S + "Lecture13, GRU, LSTM, Attention.pdf" },
      { label: "Homework 5 (PDF): build LSTM & GRU layers", href: HP + "DLHomework5.pdf" },
    ],
    content: `
<p>If gradients vanish because information is repeatedly squashed, give the network a way to <em>choose</em> what to keep. That's gating.</p>
<h3>LSTM: a conveyor belt with gates</h3>
<p>The LSTM adds a <strong>cell state</strong> — a memory lane running through time almost untouched — controlled by three learned gates:</p>
<pre><code>forget gate:  what to erase from the cell
input gate:   what new information to write
output gate:  what part of the cell to reveal as hₜ</code></pre>
<p>Because the cell updates are additive (not repeatedly squashed), gradients survive across hundreds of steps — the same highway trick as ResNet, discovered years earlier.</p>
<h3>GRU: the economical cousin</h3>
<p>Two gates (update, reset), no separate cell state, fewer parameters, usually comparable results. A sensible default when data is limited.</p>
<h3>Attention: stop compressing, start looking</h3>
<p>Even gated RNNs squeeze the whole past into one vector. Attention lets each decoding step <strong>look back at all encoder states</strong> and take a learned weighted average — direct access instead of memory. It began as an RNN add-on for translation; the next lecture removes the RNN entirely and keeps only the attention.</p>
<div class="callout">💡 <span>HW5 is the real test: implement LSTM and GRU as custom layers (inheriting <code>tf.keras.layers.Layer</code>) and swap them into a working pipeline — gates stop being diagrams once you've written them.</span></div>`,
    takeaways: [
      "Gates let networks learn what to remember, write and reveal.",
      "LSTM's additive cell state is a gradient highway across time (ResNet's trick, earlier).",
      "GRU: two gates, fewer params, similar power.",
      "Attention replaces the memory bottleneck with direct weighted access to the whole past.",
    ],
    quiz: [
      {
        q: "The LSTM forget gate decides…",
        options: [
          "The learning rate",
          "How much of the existing cell-state memory to erase at this step",
          "The sequence length",
          "Which words are nouns",
        ],
        answer: 1,
        explain: "Each gate is a learned sigmoid mask; the forget gate scales the previous cell state before new writes.",
      },
      {
        q: "Attention improves on gated RNNs by…",
        options: [
          "Making sequences shorter",
          "Letting each step directly access ALL previous states via learned weights, instead of one compressed summary vector",
          "Removing the need for training",
          "Using bigger hidden states",
        ],
        answer: 1,
        explain: "No single bottleneck vector: relevance is computed on demand — the idea the transformer is built entirely from.",
      },
    ],
  };

  const lec15 = {
    id: "dl-lec15",
    title: "Transformers II & Special Convolutions",
    minutes: 13,
    materials: [{ label: "Slides: L15 — Transformer, Dilated & Transposed Convolutions", href: S + "Lecture15, Transformer, Dilated and Transposed Convolutions.pdf" }],
    content: `
<p>Two halves: finishing the transformer, and two convolution variants every practitioner eventually needs.</p>
<h3>Transformer, assembled</h3>
<p>This lecture completes the picture from Lecture 14: multi-head attention, positional encodings, the encoder–decoder split (encoder sees everything; decoder attends causally to what's generated so far), and training with masking. If Lecture 14 gave the mechanism, this one gives the machine.</p>
<h3>Dilated convolutions: see wide, pay small</h3>
<p>Insert gaps in the kernel: a 3×3 with dilation 2 covers a 5×5 area with 9 weights. Stacked dilations grow the receptive field <em>exponentially</em> without pooling away resolution — the trick behind WaveNet's audio and dense segmentation.</p>
<h3>Transposed convolutions: learned upsampling</h3>
<p>Ordinary convs shrink maps; transposed convs (a.k.a. deconvolutions) learn to <em>expand</em> them — the standard decoder move in segmentation (U-Net), super-resolution and generators (next lectures' autoencoders and GANs). Beware the checkerboard artifacts when stride and kernel size clash.</p>
<div class="callout">💡 <span>Mental sorting: need context without losing resolution → dilated; need to grow spatial size back → transposed. Both will reappear within two lectures.</span></div>`,
    takeaways: [
      "Encoder attends fully; decoder attends causally — masking makes generation trainable.",
      "Dilated convs grow receptive fields exponentially at full resolution.",
      "Transposed convs learn upsampling — the decoder half of segmentation and generative nets.",
    ],
    quiz: [
      {
        q: "A 3×3 kernel with dilation rate 2…",
        options: [
          "Has 25 weights",
          "Covers a 5×5 receptive field while still using only 9 weights",
          "Downsamples the image",
          "Is the same as stride 2",
        ],
        answer: 1,
        explain: "Dilation spreads the 9 taps apart with gaps — wider view, same cost, no resolution loss.",
      },
      {
        q: "Transposed convolutions are typically used to…",
        options: [
          "Classify images faster",
          "Learn to upsample feature maps back to higher resolution (segmentation decoders, generators)",
          "Normalize activations",
          "Replace attention",
        ],
        answer: 1,
        explain: "They're the learnable inverse-shape operation of a strided conv — how decoders rebuild spatial detail.",
      },
    ],
  };

  const lec16 = {
    id: "dl-lec16",
    title: "KL Divergence & Introduction to Autoencoders",
    minutes: 13,
    materials: [{ label: "Slides: L16 — KL Divergence, Intro to Autoencoders", href: S + "Lecture16, KL Divergence, Introduction to Autoencoders.pdf" }],
    content: `
<p>Generative modeling needs a way to say "these two <em>distributions</em> are close." Enter the Kullback–Leibler divergence:</p>
<pre><code>KL(P ‖ Q) = Σ P(x) · log( P(x) / Q(x) )</code></pre>
<p>Zero iff the distributions match; grows as Q assigns low probability where P has mass. It's <strong>asymmetric</strong> — KL(P‖Q) ≠ KL(Q‖P) — and that choice matters (mode-covering vs mode-seeking behavior). Familiar face: cross-entropy = entropy(P) + KL(P‖Q), so minimizing cross-entropy IS minimizing a KL divergence. The math track's probability module cashes out here.</p>
<h3>Autoencoders: learn by reconstructing</h3>
<p>Squeeze the input through a bottleneck and demand the output match the input:</p>
<pre><code>x → encoder → z (small!) → decoder → x̂,   loss = ‖x − x̂‖²</code></pre>
<p>No labels needed — the data supervises itself. To reconstruct through a narrow z, the encoder must keep only what matters: a learned, nonlinear generalization of PCA (which you met in ML Lecture 10 — an autoencoder with linear layers and MSE essentially <em>is</em> PCA).</p>
<div class="callout">💡 <span>KL + autoencoders are the two ingredients of the variational autoencoder — and the KL term is exactly what shapes its latent space. Next lecture builds on both.</span></div>`,
    takeaways: [
      "KL(P‖Q) measures how badly Q models P; zero iff equal; asymmetric.",
      "Cross-entropy minimization is KL minimization in disguise.",
      "Autoencoders self-supervise via reconstruction through a bottleneck — nonlinear PCA.",
    ],
    quiz: [
      {
        q: "KL(P ‖ Q) equals zero exactly when…",
        options: [
          "P is uniform",
          "The two distributions are identical",
          "Q is Gaussian",
          "Never",
        ],
        answer: 1,
        explain: "Every log(P/Q) term is 0 only when P(x) = Q(x) everywhere — KL is a (non-symmetric) measure of mismatch.",
      },
      {
        q: "Why does an autoencoder's bottleneck force useful learning?",
        options: [
          "It speeds up the GPU",
          "Reconstruction through a small z is only possible if the encoder keeps the informative structure and discards the rest",
          "It adds labels",
          "It prevents backpropagation",
        ],
        answer: 1,
        explain: "The narrow latent code is an information budget: spending it on noise makes reconstruction fail.",
      },
    ],
  };

  const lec17 = {
    id: "dl-lec17",
    title: "Autoencoders in Practice",
    minutes: 12,
    materials: [{ label: "Slides: L17 — Autoencoders", href: S + "Lecture17, Autoencoders.pdf" }],
    content: `
<p>With the mechanism in hand, this lecture is about what autoencoders are <em>for</em> — and their most useful variants.</p>
<ul>
<li><strong>Denoising autoencoders</strong> — corrupt the input (noise, masking), demand the <em>clean</em> reconstruction. The model must learn real structure to undo damage. (Masked-input pretraining — BERT, MAE — is this idea at billion scale.)</li>
<li><strong>Anomaly detection</strong> — train on normal data only; anomalies reconstruct poorly, so <em>reconstruction error is the alarm</em>. Fraud, defective parts, network intrusions.</li>
<li><strong>Representation learning / pretraining</strong> — the encoder's z becomes features for downstream tasks when labels are scarce; you built the intuition in the DL track's embeddings lesson.</li>
<li><strong>Variational autoencoders (VAE)</strong> — make the latent space a <em>distribution</em>: encode to a mean and variance, sample, and add a KL term pulling the latents toward a standard Gaussian. Result: a smooth latent space you can sample from — a true generative model, and last lecture's KL doing real work.</li>
</ul>
<div class="callout">💡 <span>Rule of thumb: reconstruction error is only meaningful relative to training data. An autoencoder is a lens shaped like its dataset — anomaly detection works because the lens blurs what it has never seen.</span></div>`,
    takeaways: [
      "Denoising/masking objectives force robust structure learning (ancestor of modern pretraining).",
      "Anomaly detection: high reconstruction error on data unlike the training set.",
      "VAEs encode distributions + a KL prior → smooth, sampleable latent spaces.",
    ],
    quiz: [
      {
        q: "How does an autoencoder detect anomalies?",
        options: [
          "It classifies them with softmax",
          "Trained on normal data, it reconstructs anomalies badly — high reconstruction error flags them",
          "It clusters them",
          "It cannot",
        ],
        answer: 1,
        explain: "The model only learned to compress 'normal'; anything off-manifold doesn't survive the bottleneck round-trip.",
      },
      {
        q: "What does the KL term in a VAE's loss do?",
        options: [
          "Speeds up convergence",
          "Pulls the encoded latent distribution toward a standard Gaussian, making the latent space smooth and sampleable",
          "Increases reconstruction sharpness",
          "Replaces the decoder",
        ],
        answer: 1,
        explain: "Without it, latents scatter arbitrarily; with it, nearby z's decode to coherent samples — generation becomes possible.",
      },
    ],
  };

  const lec18 = {
    id: "dl-lec18",
    title: "GANs: Generative Adversarial Networks",
    minutes: 13,
    materials: [{ label: "Slides: L18 — GANs", href: S + "Lecture18, GANs.pdf" }],
    content: `
<p>The course's finale: instead of measuring reconstruction, let two networks fight.</p>
<pre><code>Generator  G: noise z → fake sample      (the forger)
Discriminator D: sample → real or fake?  (the detective)

D trains to catch fakes; G trains to fool D.
min_G max_D  E[log D(x)] + E[log(1 − D(G(z)))]</code></pre>
<p>The discriminator is a <em>learned loss function</em>: instead of hand-writing what "realistic" means, G gets its gradient straight from a network whose job is telling real from fake. At the (theoretical) equilibrium, G's distribution matches the data and D is reduced to coin-flipping.</p>
<h3>Why GANs are famously tricky</h3>
<ul>
<li><strong>Instability</strong> — two networks chasing each other; if D gets too strong, G's gradients die.</li>
<li><strong>Mode collapse</strong> — G finds one convincing output and produces it forever: high quality, zero diversity.</li>
<li>Fixes in practice: architecture discipline (DCGAN's transposed-conv generator — Lecture 15 pays off), label smoothing, alternative losses (Wasserstein).</li>
</ul>
<div class="callout">💡 <span>Contrast the two generative families you now know: VAEs optimize an explicit likelihood bound (stable, blurrier); GANs optimize an adversarial game (sharp, unstable). Diffusion models — today's image generators — took a third road, but GAN intuition still pays rent.</span></div>`,
    takeaways: [
      "GAN = generator vs discriminator in a minimax game; D is a learned loss.",
      "Mode collapse: sharp but non-diverse output — the classic GAN failure.",
      "Generators are built from transposed convolutions (Lecture 15).",
      "VAE: stable/likelihood-based; GAN: sharp/adversarial — complementary trade-offs.",
    ],
    quiz: [
      {
        q: "In a GAN, the discriminator's role during training is to…",
        options: [
          "Generate samples",
          "Act as a learned loss: its real/fake judgments provide the gradient the generator learns from",
          "Store the dataset",
          "Prevent overfitting in the generator",
        ],
        answer: 1,
        explain: "G never sees real data directly — it improves only through D's feedback, a loss function that itself keeps learning.",
      },
      {
        q: "Mode collapse means the generator…",
        options: [
          "Produces low-quality noise",
          "Produces only a few (or one) convincing outputs, abandoning the data's diversity",
          "Stops training",
          "Copies the discriminator",
        ],
        answer: 1,
        explain: "G finds a shortcut that reliably fools D and exploits it — quality without coverage.",
      },
    ],
  };

  /* ---------- rebuild the track ---------- */

  track.tagline = "The FAST Deep Learning course, lecture by lecture — from a single neuron to transformers, autoencoders and GANs — with slides, homework and solutions.";

  track.modules = [
    {
      id: "dl-m1",
      title: "Lectures 1–6 · Training Neural Networks",
      lessons: [lec1, byId["dl-1-1"], lec3, byId["dl-1-2"], lec5, byId["dl-1-3"]].filter(Boolean),
    },
    {
      id: "dl-m2",
      title: "Lectures 7–11 · Convolutional Networks",
      lessons: [byId["dl-2-1"], lec8, lec9, byId["dl-3-1"], lec11].filter(Boolean),
    },
    {
      id: "dl-m3",
      title: "Lectures 12–15 · Sequences & Transformers",
      lessons: [lec12, lec13, byId["dl-2-2"], lec15].filter(Boolean),
    },
    {
      id: "dl-m4",
      title: "Lectures 16–18 · Generative Models",
      lessons: [lec16, lec17, lec18],
    },
    {
      id: "dl-m5",
      title: "Beyond the Course",
      lessons: [byId["dl-3-2"]].filter(Boolean),
    },
  ];
})();
