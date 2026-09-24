/* 1991 Academy — FAST "Machine Learning" course integration.
   Restructures the ML track so the course part is ONE LESSON PER LECTURE
   (like the math track): 10 lecture lessons, each with its slide deck,
   its homework folder and its verified FAST lecture video, followed by an
   "ML in Practice" module with the non-lecture lessons.
   Slides are ground truth for numbering; the video playlist numbering
   differs (e.g. video L5 covers slide L3's decision trees) — mapped by topic. */
(function () {
  const track = window.MARTINIUM.tracks.ml;
  if (!track) return;
  const byId = {};
  for (const m of track.modules) for (const l of m.lessons) byId[l.id] = l;

  const FAST = "FAST Foundation";
  const LEC = "full lecture";
  const A = "../assets/courses/ml/";
  const S = A + "Slides/";
  const H = A + "HW/";

  /* ---------- augment the kept lessons (videos first: they ARE the course) ---------- */

  function fastVideo(id, title) {
    return { id, title, channel: FAST, length: LEC };
  }

  function augment(id, videos, materials) {
    const l = byId[id];
    if (!l) return;
    if (videos.length) l.videos = videos.concat(l.videos || []);
    if (materials.length) l.materials = materials;
  }

  /* Lecture 1 — reuses "What ML Actually Is" */
  augment("ml-1-1",
    [fastVideo("bYbGODu1s_w", "Lecture 1 | Introduction to Machine Learning")],
    [{ label: "Slides: Lecture 1 — Ingredients of ML", href: S + "Lecture1.pdf" }]);

  /* Lecture 6 — reuses "Linear Models & Gradient Descent" */
  augment("ml-1-2",
    [fastVideo("VbnEhRvbrnw", "Lecture 7 | Regression Methods (part 1)")],
    [
      { label: "Slides: Lecture 6 — Intro to Regression", href: S + "Lecture6_Intro_to_Regression.pdf" },
      { label: "HW5 notebook (build linear regression)", href: H + "5/HW5.ipynb" },
      { label: "Starter: linear_regression.py", href: H + "5/linear_regression.py" },
      { label: "Dataset: data.csv", href: H + "5/data.csv" },
    ]);

  /* Lecture 7 — reuses "Overfitting & Generalization" */
  augment("ml-1-3",
    [fastVideo("4F0Givo2Cs8", "Lecture 8 | Regression Methods (part 2)")],
    [
      { label: "Slides: Lecture 7 — Regression Methods 2", href: S + "Lecture7_RegressionMethods2.pdf" },
      { label: "HW6 notebook (regularized regression)", href: H + "6/HW6.ipynb" },
      { label: "Starter: regression.py", href: H + "6/regression.py" },
    ]);

  /* ---------- new lecture lessons ---------- */

  const lec2 = {
    id: "ml-lec2",
    title: "k-NN & Naive Bayes",
    minutes: 14,
    videos: [
      fastVideo("jQXTufT_Kn8", "Lecture 2 | K Nearest Neighbours, Naive Bayes"),
      fastVideo("3H0O00iB2O8", "Lecture 3 | Linear & Quadratic Discriminant Analysis"),
    ],
    materials: [
      { label: "Slides: Lecture 2 — Basics of Classification", href: S + "Lecture2.pdf" },
      { label: "HW1 notebook (build kNN & Naive Bayes)", href: H + "1/HW1.ipynb" },
      { label: "Starter: knn.py", href: H + "1/knn.py" },
      { label: "Starter: naive_bayes.py", href: H + "1/naive_bayes.py" },
      { label: "Dataset: car.csv", href: H + "1/car.csv" },
    ],
    content: `
<p>Two classifiers with opposite personalities open the course — one memorizes, one believes.</p>
<h3>k-Nearest Neighbours: the lazy learner</h3>
<p>No training at all: to classify a point, find the k closest training examples and take a majority vote. You already built it in the Lab — this lecture makes it rigorous: distance metrics, choosing k (small k → jagged, noise-sensitive boundaries; large k → smooth, possibly oblivious), and why kNN suffers in high dimensions (the <em>curse of dimensionality</em>: with many features everything becomes equally far away).</p>
<h3>Naive Bayes: the honest believer</h3>
<p>Flip the question with Bayes' rule (math track, probability module!):</p>
<pre><code>P(class | features) ∝ P(features | class) · P(class)</code></pre>
<p>The "naive" part assumes features are <strong>conditionally independent given the class</strong> — so the likelihood factorizes into per-feature terms you can estimate by counting. Obviously wrong in practice, yet shockingly effective: spam filtering ran on it for a decade. The classic play-tennis dataset in the slides shows the whole computation by hand.</p>
<h3>When to use which</h3>
<ul>
<li><strong>kNN</strong>: small datasets, few dimensions, irregular boundaries; costs at <em>prediction</em> time.</li>
<li><strong>Naive Bayes</strong>: text/categorical data, tiny training sets, needs speed; costs almost nothing ever.</li>
</ul>
<div class="callout">💡 <span>HW1 has you implement both from scratch (knn.py, naive_bayes.py) and test them on the car-evaluation dataset — the same "build it yourself" philosophy as the Lab.</span></div>`,
    takeaways: [
      "kNN: vote among the k nearest points; k controls bias–variance; distances degrade in high dimensions.",
      "Naive Bayes: Bayes' rule + conditional-independence assumption → count-based, fast, great on text.",
      "Lazy (kNN, pay at prediction) vs eager (NB, pay at training) learning.",
    ],
    quiz: [
      {
        q: "Making k larger in kNN generally…",
        options: [
          "Makes the boundary more jagged",
          "Smooths the decision boundary (less variance, more bias)",
          "Speeds up prediction",
          "Has no effect",
        ],
        answer: 1,
        explain: "Averaging over more neighbours washes out noise (variance ↓) but can blur real structure (bias ↑) — the bias–variance dial again.",
      },
      {
        q: "The 'naive' assumption in Naive Bayes is that…",
        options: [
          "All classes are equally likely",
          "Features are conditionally independent given the class",
          "The data is Gaussian",
          "Labels are noiseless",
        ],
        answer: 1,
        explain: "Independence lets P(features|class) factor into per-feature probabilities estimable by simple counting.",
      },
      {
        q: "Which model does literally zero work at training time?",
        options: ["Naive Bayes", "kNN — it just stores the data", "Logistic regression", "A decision tree"],
        answer: 1,
        explain: "kNN is a lazy learner: all computation (finding neighbours) happens at prediction time.",
      },
    ],
  };

  const lec3 = {
    id: "ml-lec3",
    title: "Decision Trees",
    minutes: 14,
    videos: [fastVideo("mmRO3QRDBYI", "Lecture 5 | Kernel Methods & Decision Trees")],
    materials: [
      { label: "Slides: Lecture 3 — Decision Trees", href: S + "Lecture3_DecisionTrees.pdf" },
      { label: "HW2 notebook (build a decision tree)", href: H + "2/HW2.ipynb" },
      { label: "Starter: decision_tree.py", href: H + "2/decision_tree.py" },
      { label: "Dataset: adult.data.csv", href: H + "2/adult.data.csv" },
    ],
    content: `
<p>A decision tree asks a sequence of if/else questions about features until it's confident enough to answer. The whole craft is: <em>which question do you ask first?</em></p>
<h3>Choosing splits: impurity</h3>
<p>A good split makes the resulting groups <strong>purer</strong> — closer to single-class. Two standard purity scores:</p>
<pre><code>entropy(p) = − Σ pᵢ · log₂ pᵢ          (information theory)
gini(p)    = 1 − Σ pᵢ²                  (probability of mislabeling)</code></pre>
<p>The tree greedily picks the feature/threshold with the largest <strong>information gain</strong> — the drop in impurity from parent to children — then recurses on each side.</p>
<h3>The overfitting machine</h3>
<p>Grown without limits, a tree will happily create one leaf per training example: 100% train accuracy, memorization, terrible generalization. Controls: <code>max_depth</code>, <code>min_samples_leaf</code>, or growing fully and <strong>pruning</strong> back. (This is why single trees lost to ensembles — two lectures from now.)</p>
<h3>Why practitioners still love them</h3>
<ul>
<li>Interpretable — you can read the rules and audit decisions.</li>
<li>No feature scaling; handles numeric + categorical mixes natively.</li>
<li>Captures interactions and nonlinearity automatically.</li>
</ul>
<div class="callout">💡 <span>HW2's decision_tree.py has you implement gini, information gain and the recursive splitter yourself, then run it on the adult-income census dataset.</span></div>`,
    takeaways: [
      "Trees pick splits by information gain — the impurity drop (entropy or gini).",
      "Unconstrained trees memorize; depth/leaf limits and pruning fight it.",
      "Strengths: interpretability, no scaling, mixed feature types, interactions for free.",
    ],
    quiz: [
      {
        q: "A node holds 50% class A and 50% class B. Its gini impurity is…",
        options: ["0", "0.5 — the maximum for two classes", "1", "0.25"],
        answer: 1,
        explain: "gini = 1 − (0.5² + 0.5²) = 0.5. A pure node scores 0; a 50/50 mix is as impure as two classes get.",
      },
      {
        q: "Information gain of a split is…",
        options: [
          "The number of samples it separates",
          "The reduction in impurity from the parent node to the weighted children",
          "The depth it adds to the tree",
          "The training accuracy",
        ],
        answer: 1,
        explain: "Gain = parent impurity − weighted average child impurity; the greedy tree maximizes it at every node.",
      },
      {
        q: "A fully-grown, unpruned tree usually shows…",
        options: [
          "High bias, low variance",
          "Near-perfect training accuracy but poor test accuracy — overfitting",
          "Underfitting",
          "The same accuracy everywhere",
        ],
        answer: 1,
        explain: "One-leaf-per-example is memorization: the signature train/test gap of an overfit model.",
      },
    ],
  };

  const lec4 = {
    id: "ml-lec4",
    title: "Support Vector Machines",
    minutes: 15,
    videos: [fastVideo("aSLwpjK75Xg", "Lecture 4 | Support Vector Machine")],
    materials: [
      { label: "Slides: Lecture 4 — SVM", href: S + "Lecture4_SVM.pdf" },
      { label: "HW3 notebook (build SVM + kernels)", href: H + "3/HW3.ipynb" },
      { label: "Starter: svm.py", href: H + "3/svm.py" },
      { label: "Starter: svm_with_kernels.py", href: H + "3/svm_with_kernels.py" },
    ],
    content: `
<p>Many lines can separate two classes. The SVM chooses the one with the <strong>widest margin</strong> — maximum distance to the closest points of either class. Those closest points are the <strong>support vectors</strong>: they alone define the boundary; every other point could vanish without changing anything.</p>
<h3>Soft margins: the C knob</h3>
<p>Real data isn't cleanly separable, so the SVM allows violations at a price. The hyperparameter <code>C</code> sets the price:</p>
<pre><code>large C → violations expensive → tight fit, narrower margin (variance ↑)
small C → violations cheap     → wider margin, more tolerant (bias ↑)</code></pre>
<h3>The kernel trick</h3>
<p>The real magic: the SVM's math only ever needs <em>dot products</em> between points. A <strong>kernel</strong> computes the dot product <em>as if</em> the data had been mapped into a much higher-dimensional space — without ever going there:</p>
<pre><code>linear:  K(x, y) = x·y
poly:    K(x, y) = (x·y + 1)^d
RBF:     K(x, y) = exp(−γ‖x − y‖²)   ← bends around anything</code></pre>
<p>A dataset that's a ring inside a ring is hopeless for a line — and trivially separable after the RBF kernel's implicit lift. (Remember XOR from the DL track? Same "fold space until it's separable" idea, different machinery.)</p>
<div class="callout">💡 <span>HW3 builds it in two stages: svm.py (linear, hinge loss) then svm_with_kernels.py — you'll feel exactly where the kernel slots into the math.</span></div>`,
    takeaways: [
      "SVM = maximum-margin separator; only the support vectors matter.",
      "C trades margin width against violations — a bias–variance dial.",
      "Kernels compute high-dimensional dot products implicitly; RBF handles wildly nonlinear boundaries.",
    ],
    quiz: [
      {
        q: "Removing a training point that is NOT a support vector…",
        options: [
          "Always changes the boundary",
          "Leaves the decision boundary exactly unchanged",
          "Makes the margin smaller",
          "Invalidates the kernel",
        ],
        answer: 1,
        explain: "The boundary is determined solely by the support vectors — the points touching the margin.",
      },
      {
        q: "Increasing C in a soft-margin SVM…",
        options: [
          "Widens the margin and tolerates more errors",
          "Penalizes violations more, fitting training data tighter (risking overfit)",
          "Changes the kernel",
          "Speeds up training",
        ],
        answer: 1,
        explain: "Large C makes margin violations expensive: the model contorts to classify training points correctly — variance up.",
      },
      {
        q: "The kernel trick works because SVM computations only require…",
        options: [
          "The raw coordinates in the high-dimensional space",
          "Dot products between data points, which kernels supply directly",
          "The labels",
          "Gradient descent",
        ],
        answer: 1,
        explain: "Since only inner products appear in the math, replacing them with K(x,y) implicitly works in the lifted space at no extra cost.",
      },
    ],
  };

  const lec5 = {
    id: "ml-lec5",
    title: "Ensemble Methods",
    minutes: 14,
    videos: [fastVideo("YNMOJVay4Yw", "Lecture 6 | Ensemble Methods")],
    materials: [
      { label: "Slides: Lecture 5 — Ensemble Methods", href: S + "Lecture5_EnsembleMethods.pdf" },
      { label: "HW4 notebook (build ensembles)", href: H + "4/HW4.ipynb" },
      { label: "Starter: ensemble_methods.py", href: H + "4/ensemble_methods.py" },
      { label: "Extra: SVM on Military data.ipynb", href: H + "4/SVM on Military data.ipynb" },
    ],
    content: `
<p>Ask one expert, get one opinion. Ask a hundred <em>diverse</em> experts and average — the noise cancels, the signal stays. That's the entire theory of ensembles, and it wins competitions to this day.</p>
<h3>Bagging: bootstrap + aggregate</h3>
<p>Train each model on a <strong>bootstrap sample</strong> (draw n examples <em>with replacement</em>), then vote/average. Each model sees a slightly different world, so their mistakes decorrelate. Bonus: the ~37% of data each model never saw ("out-of-bag") gives a free validation estimate.</p>
<h3>Random Forest: bagging + feature randomness</h3>
<p>Bagged trees can still all lean on the same dominant feature. Random forests also restrict each <em>split</em> to a random subset of features, forcing genuine diversity. Result: the most reliable default model in tabular ML — hard to overfit, nearly tuning-free.</p>
<h3>Voting & stacking</h3>
<p>Ensembles need not be same-model: combine an SVM, a tree and kNN by majority vote — or go further and <strong>stack</strong> them, training a meta-model on their outputs. HW4 has you build exactly these combiners in ensemble_methods.py.</p>
<div class="callout">💡 <span>The averaging math: for m models with uncorrelated errors of variance σ², the average's variance is σ²/m. Correlation is the enemy — every trick here (bootstraps, feature subsets) exists to decorrelate.</span></div>`,
    takeaways: [
      "Averaging diverse models cancels uncorrelated errors (variance σ²/m).",
      "Bagging = bootstrap samples + aggregation; out-of-bag data gives free validation.",
      "Random forests add per-split feature randomness for extra decorrelation.",
      "Voting/stacking combine different model families.",
    ],
    quiz: [
      {
        q: "Why does bagging reduce variance?",
        options: [
          "It uses less data",
          "Models trained on different bootstrap samples make decorrelated errors that average out",
          "It regularizes the loss function",
          "It increases tree depth",
        ],
        answer: 1,
        explain: "Each resample yields a different model; averaging m weakly-correlated predictors shrinks the noise toward σ²/m.",
      },
      {
        q: "What does a random forest add on top of plain bagged trees?",
        options: [
          "Gradient descent",
          "A random subset of features considered at each split, decorrelating the trees further",
          "Pruning",
          "A kernel",
        ],
        answer: 1,
        explain: "Feature-subset splits stop every tree from keying on the same strong feature — the diversity is the point.",
      },
      {
        q: "The 'out-of-bag' samples for a given tree are…",
        options: [
          "Corrupted rows",
          "The training rows its bootstrap sample happened not to include — usable as a free validation set",
          "Test-set rows",
          "The support vectors",
        ],
        answer: 1,
        explain: "Sampling with replacement leaves ~37% of rows out of each bootstrap; evaluating each tree on its own leftovers estimates generalization for free.",
      },
    ],
  };

  const lec8 = {
    id: "ml-lec8",
    title: "Adaptive & Gradient Boosting",
    minutes: 15,
    videos: [fastVideo("0l6ltF14BAs", "Lecture 9 | Adaptive & Gradient Boosting")],
    materials: [
      { label: "Slides: Lecture 8 — Boosting", href: S + "Lecture8_Boosting.pdf" },
      { label: "HW7 notebook (build boosting)", href: H + "7/HW7.ipynb" },
      { label: "Starter: boosting.py", href: H + "7/boosting.py" },
    ],
    content: `
<p>Bagging trains its models independently, in parallel. Boosting is the opposite bet: train weak models <strong>sequentially, each one focusing on what the previous ones got wrong</strong>.</p>
<h3>AdaBoost: reweight the mistakes</h3>
<pre><code>start: every sample has equal weight
repeat:
  train a weak learner (often a 1-split "stump") on the weighted data
  increase the weights of the samples it MISCLASSIFIED
  give the learner a say proportional to its accuracy
final prediction: weighted vote of all learners</code></pre>
<p>Hard examples accumulate weight until some learner finally deals with them.</p>
<h3>Gradient boosting: fit the residuals</h3>
<p>Reframe boosting as gradient descent in function space: each new tree fits the <strong>residual errors</strong> (more generally, the negative gradient of the loss) of the ensemble so far, and is added with a small <strong>learning rate</strong>:</p>
<pre><code>F₀ = mean(y)
Fₘ = Fₘ₋₁ + η · tree_m(residuals of Fₘ₋₁)</code></pre>
<p>Small η + many trees = slow, careful correction — the shrinkage that makes boosting generalize. XGBoost/LightGBM industrialize exactly this loop, and they remain the strongest default on tabular data.</p>
<div class="callout">💡 <span>Bagging attacks <strong>variance</strong> (average out noise); boosting attacks <strong>bias</strong> (relentlessly fix systematic errors) — which is why boosting uses weak, shallow learners on purpose. HW7's boosting.py makes you write the loop.</span></div>`,
    takeaways: [
      "Boosting trains learners sequentially, each fixing its predecessors' mistakes.",
      "AdaBoost reweights misclassified samples; gradient boosting fits residuals/negative gradients.",
      "Learning rate (shrinkage) + many weak learners = the generalization recipe.",
      "Bagging fights variance; boosting fights bias.",
    ],
    quiz: [
      {
        q: "After each AdaBoost round, the training samples that get MORE weight are…",
        options: [
          "The correctly classified ones",
          "The misclassified ones — forcing the next learner to focus on them",
          "Random ones",
          "The support vectors",
        ],
        answer: 1,
        explain: "Upweighting mistakes is AdaBoost's core mechanism: hard cases grow until a learner handles them.",
      },
      {
        q: "In gradient boosting, each new tree is trained to predict…",
        options: [
          "The original labels from scratch",
          "The residual errors (negative gradient) of the current ensemble",
          "The feature importances",
          "The learning rate",
        ],
        answer: 1,
        explain: "Fitting residuals is a gradient-descent step in function space — each tree nudges the ensemble toward lower loss.",
      },
      {
        q: "Why does boosting deliberately use weak (shallow) learners?",
        options: [
          "Many small corrections compose gracefully — boosting's job is bias reduction, and strong per-step learners would overfit early",
          "Deep trees are illegal in boosting",
          "Weak learners have lower bias",
          "To reduce the dataset size",
        ],
        answer: 0,
        explain: "Boosting accumulates gentle sequential corrections; an overpowered learner per step memorizes instead of correcting.",
      },
    ],
  };

  /* ---------- unsupervised lessons (Lectures 9 & 10) ---------- */

  const lec9 = {
    id: "ml-4-1",
    title: "Clustering: Finding Structure Without Labels",
    minutes: 13,
    videos: [fastVideo("LVFx2ex2ll0", "Lecture 10 | Unsupervised Learning (part 1)")],
    materials: [
      { label: "Slides: Lecture 9 — Clustering", href: S + "Lecture9_Clustering.pdf" },
      { label: "HW8 notebook (build clustering)", href: H + "8/HW8.ipynb" },
      { label: "Starter: unsupervised.py", href: H + "8/unsupervised.py" },
      { label: "Dataset: smile1.csv", href: H + "8/smile1.csv" },
      { label: "Dataset: dartboard1.csv", href: H + "8/dartboard1.csv" },
    ],
    content: `
<p>No labels, no targets — just data. Unsupervised learning asks: <em>what structure is in here?</em> Clustering is its flagship: group points so that members of a group are similar to each other and different from the rest.</p>
<h3>k-means and its blind spot</h3>
<p>You built k-means from scratch in the Lab: assign points to the nearest centroid, move centroids to their group's mean, repeat. It's fast and everywhere — but it assumes clusters are <strong>round blobs</strong>. The course's HW8 datasets are chosen to break it: a smiley face and a dartboard, where the true clusters are rings and curves that no centroid can capture.</p>
<h3>Beyond centroids</h3>
<ul>
<li><strong>Hierarchical clustering</strong> — merge the closest pairs step by step into a tree (dendrogram); cut the tree at any level to get any number of clusters.</li>
<li><strong>DBSCAN</strong> — density-based: clusters are dense regions separated by sparse ones. Finds rings and arbitrary shapes, marks stragglers as noise, and doesn't need k in advance.</li>
</ul>
<h3>How do you evaluate without labels?</h3>
<p>There's no accuracy when nothing is labeled. Internal metrics like <strong>inertia</strong> (within-cluster spread, what k-means minimizes) and the <strong>silhouette score</strong> (how much closer each point is to its own cluster than the next one) guide the choice of k — the classic "elbow" heuristic reads the bend in inertia-vs-k.</p>
<div class="callout">💡 <span>Download the smile and dartboard datasets above and try your Lab k-means on them — watching centroids fail on rings teaches more than any definition of DBSCAN.</span></div>`,
    takeaways: [
      "Clustering groups unlabeled data by similarity.",
      "k-means assumes round blobs; rings and curves defeat it.",
      "DBSCAN clusters by density — arbitrary shapes, no k needed, noise handled.",
      "Without labels, use inertia/silhouette (and the elbow) to judge clusterings.",
    ],
    quiz: [
      {
        q: "Why does k-means fail on the HW8 'smile' and 'dartboard' datasets?",
        options: [
          "Too many points",
          "Its clusters are defined by nearest centroid — effectively round blobs — while these clusters are rings and curves",
          "The CSV files are corrupted",
          "k-means only works in 1D",
        ],
        answer: 1,
        explain: "Every k-means cluster is the set of points nearest a center — a convex, blob-shaped region. Rings and smiles aren't blobs; density-based methods like DBSCAN handle them.",
      },
      {
        q: "The 'elbow method' chooses k by…",
        options: [
          "Maximizing accuracy on labels",
          "Finding where adding more clusters stops meaningfully reducing within-cluster spread (inertia)",
          "Always picking k = 3",
          "Minimizing the number of iterations",
        ],
        answer: 1,
        explain: "Inertia always falls as k grows; the 'elbow' is where the payoff flattens — extra clusters past that point mostly split real groups.",
      },
      {
        q: "A key practical advantage of DBSCAN over k-means is…",
        options: [
          "It is always faster",
          "It finds arbitrarily-shaped clusters and flags outliers as noise, without fixing k in advance",
          "It requires labels",
          "It only needs one iteration",
        ],
        answer: 1,
        explain: "Density-based clustering follows the data's shape and leaves sparse points unassigned — no blob assumption, no preset k.",
      },
    ],
  };

  const lec10 = {
    id: "ml-4-2",
    title: "PCA: Compressing Data Intelligently",
    minutes: 13,
    videos: [fastVideo("cFZYoJX7BWI", "Lecture 11 | Unsupervised Learning (part 2)")],
    materials: [
      { label: "Slides: Lecture 10 — PCA", href: S + "Lecture10_PCA.pdf" },
      { label: "HW8 notebook (unsupervised)", href: H + "8/HW8.ipynb" },
      { label: "Dataset: 2d-10c.csv", href: H + "8/2d-10c.csv" },
    ],
    content: `
<p>Real datasets have hundreds of correlated features; much of that is redundancy. <strong>Principal Component Analysis</strong> finds the directions along which the data actually varies — and lets you keep just those.</p>
<h3>The recipe</h3>
<pre><code>1. center the data (subtract each feature's mean)
2. compute the covariance matrix
3. take its eigenvectors  → the principal components (directions)
   and eigenvalues        → the variance each direction carries
4. keep the top k components; project the data onto them</code></pre>
<p>This is the linear-algebra module paying off: the covariance matrix is symmetric, so its eigenvectors are orthogonal — PCA is a rotation into axes where features stop being correlated. Equivalently, it's the truncated SVD you met in the math track: the best possible low-rank approximation.</p>
<h3>What it's for</h3>
<ul>
<li><strong>Compression / speed</strong> — 100 features → 10 components that keep, say, 95% of the variance.</li>
<li><strong>Visualization</strong> — project anything to 2D and look at it (EDA!).</li>
<li><strong>Noise reduction & decorrelation</strong> — small-variance directions are often noise; dropping them can improve downstream models.</li>
</ul>
<div class="callout">💡 <span>Standardize features before PCA — variance is scale-sensitive, and a feature measured in millimeters will otherwise dominate one measured in meters. The "explained variance ratio" plot is PCA's elbow curve.</span></div>`,
    takeaways: [
      "PCA finds orthogonal directions of maximal variance (covariance eigenvectors).",
      "Keep the top components → best low-rank view of the data (truncated SVD).",
      "Uses: compression, 2D visualization, decorrelation, noise reduction.",
      "Standardize first; choose k by explained-variance ratio.",
    ],
    quiz: [
      {
        q: "The principal components of a dataset are…",
        options: [
          "Its most important rows",
          "The eigenvectors of its covariance matrix, ordered by variance explained",
          "The labels",
          "Randomly chosen directions",
        ],
        answer: 1,
        explain: "PCA diagonalizes the covariance matrix; eigenvectors give the directions, eigenvalues the variance along each.",
      },
      {
        q: "Why standardize features before PCA?",
        options: [
          "PCA crashes otherwise",
          "Variance depends on units — an unscaled large-range feature would dominate the components",
          "It makes the data Gaussian",
          "To remove outliers",
        ],
        answer: 1,
        explain: "PCA chases variance. Measured in different units, 'largest variance' just means 'biggest numbers' — scaling makes the comparison fair.",
      },
      {
        q: "Keeping components that explain 95% of variance while dropping the rest is best described as…",
        options: [
          "Overfitting",
          "Lossy but intelligent compression — the dropped directions carry little information (often noise)",
          "Label leakage",
          "Data augmentation",
        ],
        answer: 1,
        explain: "Truncated PCA/SVD is the optimal low-rank approximation: maximum retained variance for the chosen dimensionality.",
      },
    ],
  };

  /* ---------- rebuild the track: one lesson per lecture, then practice ---------- */

  track.tagline = "The FAST Machine Learning course, lecture by lecture — each lesson with its slides, homework and full video — plus the practical craft around it.";

  track.modules = [
    {
      id: "ml-m1",
      title: "Lectures 1–5 · Foundations & Classifiers",
      lessons: [byId["ml-1-1"], lec2, lec3, lec4, lec5].filter(Boolean),
    },
    {
      id: "ml-m2",
      title: "Lectures 6–8 · Regression & Boosting",
      lessons: [byId["ml-1-2"], byId["ml-1-3"], lec8].filter(Boolean),
    },
    {
      id: "ml-m4",
      title: "Lectures 9–10 · Unsupervised Learning",
      lessons: [lec9, lec10],
    },
    {
      id: "ml-m3",
      title: "ML in Practice",
      lessons: [byId["ml-2-1"], byId["ml-3-1"], byId["ml-3-2"]].filter(Boolean),
    },
  ];
})();
