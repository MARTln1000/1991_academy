/* 1991 Academy track: Machine Learning */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.tracks.ml = {
  id: "ml",
  title: "Machine Learning",
  tagline: "Learn to think in data: models, loss, generalization — the ideas underneath every algorithm.",
  icon: "📈",
  accent: "#a855f7",
  accentSoft: "rgba(168, 85, 247, 0.14)",
  modules: [
    {
      id: "ml-m1",
      title: "Thinking in Data",
      lessons: [
        {
          id: "ml-1-1",
          title: "What Machine Learning Actually Is",
          minutes: 11,
          videos: [
            { id: "i_LwzRVP7bg", title: "Machine Learning for Everybody — Full Course", channel: "freeCodeCamp", length: "3.9 h" },
          ],
          content: `
<p>Strip away the hype and machine learning is one idea: <strong>instead of writing rules by hand, learn them from examples.</strong></p>
<h3>Programs vs. models</h3>
<p>Classic programming: you write rules, feed in data, get answers. Machine learning flips it: you feed in data <em>and answers</em>, and the algorithm finds the rules.</p>
<pre><code>Classic:  rules + data            → answers
ML:       data  + answers (labels) → rules (a model)</code></pre>
<h3>The three flavors</h3>
<ul>
<li><strong>Supervised learning</strong> — learn from labeled examples. Predict a number (regression: house prices) or a category (classification: spam or not).</li>
<li><strong>Unsupervised learning</strong> — find structure in unlabeled data: clustering customers, compressing dimensions.</li>
<li><strong>Reinforcement learning</strong> — learn by acting and receiving rewards: game-playing agents, robotics.</li>
</ul>
<h3>The golden rule: train/test split</h3>
<p>A model's score on data it trained on is <em>meaningless</em> — it may simply have memorized. Always hold out a test set the model has never seen:</p>
<pre><code>train_data (80%) → fit the model
test_data  (20%) → the ONLY honest measure of quality</code></pre>
<div class="callout">💡 <span>Most real-world ML failures aren't exotic math errors — they're <strong>evaluation mistakes</strong>: testing on training data, leaking future information, or optimizing the wrong metric.</span></div>
<p>Everything that follows — loss functions, gradients, regularization — exists to answer one question well: <em>will this model work on data it hasn't seen?</em></p>`,
          takeaways: [
            "ML learns rules from examples instead of hand-coding them.",
            "Supervised = labeled data; regression predicts numbers, classification predicts categories.",
            "Only held-out test data measures real quality.",
            "Generalization — performance on unseen data — is the entire game.",
          ],
          quiz: [
            {
              q: "Predicting tomorrow's temperature from historical weather data is…",
              options: ["Classification", "Regression", "Clustering", "Reinforcement learning"],
              answer: 1,
              explain: "The target is a continuous number → regression. Categories would make it classification.",
            },
            {
              q: "Your model scores 99% on training data and 62% on test data. What's happening?",
              options: [
                "The model is excellent",
                "The test set is broken",
                "The model memorized the training data — overfitting",
                "You need a bigger model",
              ],
              answer: 2,
              explain: "A large train/test gap is the signature of overfitting: the model learned specifics, not generalizable patterns.",
            },
            {
              q: "Grouping customers into segments without any labels is…",
              options: ["Supervised learning", "Unsupervised learning", "Reinforcement learning", "Regression"],
              answer: 1,
              explain: "No labels, just structure discovery — that's unsupervised learning (clustering).",
            },
          ],
        },
        {
          id: "ml-1-2",
          title: "Linear Models & Gradient Descent",
          minutes: 14,
          videos: [
            { id: "IHZwWFHWa-w", title: "Gradient descent, how neural networks learn", channel: "3Blue1Brown", length: "21 min" },
          ],
          content: `
<p>Linear regression is the "hello world" of ML — and the clearest window into how <em>all</em> models learn.</p>
<h3>The model</h3>
<p>Predict a value as a weighted sum of features:</p>
<pre><code>price = w1·area + w2·rooms + w3·age + b</code></pre>
<p>Learning means finding weights <code>w</code> and bias <code>b</code> that make predictions close to reality.</p>
<h3>The loss function</h3>
<p>"Close to reality" needs a number. Mean Squared Error averages the squared mistakes:</p>
<pre><code>MSE = mean( (prediction - actual)² )</code></pre>
<p>Squaring punishes big errors hard and makes the math smooth. Now learning is an <strong>optimization problem</strong>: find the weights that minimize loss.</p>
<h3>Gradient descent: roll downhill</h3>
<p>Imagine the loss as a landscape over all possible weights. The <strong>gradient</strong> points uphill — so step the other way, repeatedly:</p>
<pre><code>repeat:
  gradient = d(loss)/d(weights)   # which direction increases loss?
  weights  = weights - lr * gradient  # step downhill</code></pre>
<p>The <strong>learning rate</strong> <code>lr</code> is the step size: too small and training crawls; too large and you overshoot the valley and diverge.</p>
<div class="callout">💡 <span>This exact loop — <strong>predict → measure loss → compute gradient → update</strong> — trains everything from linear regression to GPT. The models grow; the loop doesn't.</span></div>`,
          takeaways: [
            "A linear model is a weighted sum: features × weights + bias.",
            "Loss turns 'how wrong are we?' into a single number to minimize.",
            "Gradient descent steps weights opposite the gradient, downhill on the loss.",
            "Learning rate = step size: the most important knob in training.",
          ],
          exercises: [
            {
              type: "order",
              title: "Rebuild the learning loop",
              prompt: "Arrange the steps of one training iteration in the order they happen.",
              lines: [
                "initialize weights randomly (once, before the loop)",
                "predict outputs for the batch",
                "compute the loss against the true labels",
                "compute gradients of the loss w.r.t. the weights",
                "update weights a small step against the gradient",
              ],
            },
          ],
          quiz: [
            {
              q: "What does the gradient of the loss tell you?",
              options: [
                "The final accuracy",
                "The direction in weight-space that increases loss fastest",
                "How many epochs to train",
                "Whether data is labeled",
              ],
              answer: 1,
              explain: "The gradient points uphill on the loss surface. Stepping against it (descent) reduces loss.",
            },
            {
              q: "Training loss oscillates wildly and explodes to infinity. Most likely fix?",
              options: [
                "Increase the learning rate",
                "Lower the learning rate",
                "Add more features",
                "Remove the loss function",
              ],
              answer: 1,
              explain: "Divergence is the classic symptom of steps that are too big — each update overshoots the minimum. Lower lr.",
            },
            {
              q: "Why square the errors in MSE instead of just averaging them raw?",
              options: [
                "Squaring is faster to compute",
                "Positive and negative errors would cancel out; squaring also penalizes large errors more",
                "It converts regression to classification",
                "Tradition only",
              ],
              answer: 1,
              explain: "Raw errors of +5 and −5 average to zero, hiding the mistakes. Squaring makes all errors positive and emphasizes big misses.",
            },
          ],
        },
        {
          id: "ml-1-3",
          title: "Overfitting & Generalization",
          minutes: 13,
          content: `
<p>The central tension of ML: a model must be powerful enough to capture the pattern, but not so unconstrained that it memorizes the noise.</p>
<h3>Underfitting vs. overfitting</h3>
<ul>
<li><strong>Underfitting</strong> — the model is too simple: bad on training <em>and</em> test data. A straight line through a curved pattern.</li>
<li><strong>Overfitting</strong> — the model is too flexible: brilliant on training data, poor on test data. It learned the noise, not the signal.</li>
</ul>
<pre><code>              train error   test error
underfitting      high         high
good fit          low          low
overfitting       very low     high   ← the trap</code></pre>
<h3>Weapons against overfitting</h3>
<ol>
<li><strong>More data</strong> — the single most reliable cure. Noise averages out; signal accumulates.</li>
<li><strong>Regularization</strong> — penalize large weights by adding them to the loss (L2 / ridge, L1 / lasso). The model must "pay" for complexity.</li>
<li><strong>Simpler models</strong> — fewer parameters, shallower trees.</li>
<li><strong>Early stopping</strong> — halt training when <em>validation</em> loss stops improving, even if training loss keeps falling.</li>
</ol>
<h3>The three-way split</h3>
<p>If you tune hyperparameters against the test set, you slowly overfit <em>to the test set</em>. Hence:</p>
<pre><code>train      → fit weights
validation → choose hyperparameters, early stopping
test       → touch ONCE, at the very end</code></pre>
<div class="callout">💡 <span>Cross-validation (rotating which slice is validation) squeezes reliable estimates out of small datasets — the standard tool when data is precious.</span></div>`,
          takeaways: [
            "Overfitting = memorizing noise: great train score, poor test score.",
            "More data, regularization, simpler models, early stopping — in that order of reliability.",
            "Validation set tunes; test set is touched once.",
            "Cross-validation gives stable estimates on small datasets.",
          ],
          quiz: [
            {
              q: "High error on both training AND test data suggests…",
              options: ["Overfitting", "Underfitting", "Perfect fit", "Data leakage"],
              answer: 1,
              explain: "If the model can't even fit the training data, it's too simple (or features are uninformative) — underfitting.",
            },
            {
              q: "Why do we need a validation set separate from the test set?",
              options: [
                "To have more training data",
                "Tuning hyperparameters on the test set gradually overfits to it, inflating the final score",
                "Test sets are illegal to look at",
                "Validation sets are larger",
              ],
              answer: 1,
              explain: "Every tuning decision made by peeking at a dataset leaks information from it. The test set must stay untouched to stay honest.",
            },
            {
              q: "What does L2 regularization add to the loss?",
              options: [
                "The number of training epochs",
                "A penalty proportional to the squared size of the weights",
                "Random noise",
                "The test error",
              ],
              answer: 1,
              explain: "Adding λ·Σw² makes big weights expensive, pushing the model toward simpler, smoother solutions that generalize better.",
            },
          ],
        },
      ],
    },
    {
      id: "ml-m2",
      title: "The Core Toolkit",
      lessons: [
        {
          id: "ml-2-1",
          title: "Classification & Honest Metrics",
          minutes: 14,
          content: `
<p>Classification predicts categories — spam/ham, disease/healthy, churn/stay. The model part is easy to grasp; the <em>metrics</em> are where people get fooled.</p>
<h3>Logistic regression</h3>
<p>Take a linear model, squash its output through a sigmoid into (0, 1), read it as a probability:</p>
<pre><code>p(spam) = sigmoid(w·x + b)    # sigmoid(z) = 1 / (1 + e^(-z))
predict spam if p &gt; 0.5</code></pre>
<p>Despite the name, it's a classifier — and a shockingly strong baseline. Always try it before anything fancy.</p>
<h3>Why accuracy lies</h3>
<p>Imagine fraud detection where 1% of transactions are fraud. A model that always says "not fraud" is <strong>99% accurate</strong> and completely useless. Enter the confusion matrix:</p>
<pre><code>                 predicted +   predicted -
actually +           TP            FN   ← missed cases
actually -           FP            TN   ← false alarms

precision = TP / (TP + FP)   "when we flag, how often right?"
recall    = TP / (TP + FN)   "of all real cases, how many caught?"</code></pre>
<p>Precision and recall trade off against each other via the decision threshold. The <strong>F1 score</strong> (their harmonic mean) summarizes the balance; which one matters more depends on the cost of each error type.</p>
<div class="callout">💡 <span>Cancer screening → optimize <strong>recall</strong> (missing a case is catastrophic). Spam filtering → lean <strong>precision</strong> (flagging real mail is worse than letting one spam through).</span></div>`,
          takeaways: [
            "Logistic regression: linear model + sigmoid = probability. Strong baseline.",
            "Accuracy is misleading on imbalanced classes.",
            "Precision = trustworthiness of positive flags; recall = coverage of real positives.",
            "Choose the metric by the real-world cost of each error type.",
          ],
          exercises: [
            {
              type: "match",
              title: "Match each metric to what it answers",
              prompt: "Click a metric on the left, then its meaning on the right.",
              pairs: [
                ["Precision", "When we flag a positive, how often are we right?"],
                ["Recall", "Of all real positives, how many did we catch?"],
                ["Accuracy", "What share of ALL predictions were correct?"],
                ["F1 score", "Harmonic mean balancing precision and recall"],
              ],
            },
          ],
          quiz: [
            {
              q: "In a dataset with 1% positives, a model predicting 'negative' always gets…",
              options: ["99% accuracy but 0 recall", "1% accuracy", "Perfect F1", "99% recall"],
              answer: 0,
              explain: "It's right 99% of the time yet catches zero real positives — exactly why accuracy alone can't be trusted here.",
            },
            {
              q: "For airport security screening, which error is usually more acceptable?",
              options: [
                "False negatives (missing a threat)",
                "False positives (extra manual checks)",
                "Both equally",
                "Neither ever occurs",
              ],
              answer: 1,
              explain: "Missing a real threat (FN) is catastrophic; an unnecessary check (FP) is merely costly. So the system favors recall.",
            },
            {
              q: "Raising the decision threshold from 0.5 to 0.9 typically…",
              options: [
                "Raises precision, lowers recall",
                "Raises recall, lowers precision",
                "Raises both",
                "Changes nothing",
              ],
              answer: 0,
              explain: "You only flag near-certain cases: flags become more trustworthy (precision ↑) but more true cases slip by (recall ↓).",
            },
          ],
        },
        {
          id: "ml-2-2",
          title: "Trees, Forests & Boosting",
          minutes: 13,
          content: `
<p>Ask practitioners what actually wins on tabular data — spreadsheets, databases, business records — and the answer is usually tree ensembles, not neural networks.</p>
<h3>Decision trees</h3>
<p>A tree of if/else questions, learned from data:</p>
<pre><code>income &gt; 50k?
├── yes: owns_home?
│        ├── yes → approve (92%)
│        └── no  → review
└── no:  debt_ratio &lt; 0.3?
         ├── yes → approve (71%)
         └── no  → decline</code></pre>
<p>Trees are interpretable, handle mixed feature types, and need no feature scaling. Their weakness: a single deep tree overfits enthusiastically.</p>
<h3>Ensembles: crowds of weak learners</h3>
<ul>
<li><strong>Random Forest (bagging)</strong> — train many trees on random subsets of data and features, then average their votes. Randomness decorrelates their mistakes; averaging cancels them. Nearly tuning-free.</li>
<li><strong>Gradient Boosting (XGBoost, LightGBM, CatBoost)</strong> — train trees <em>sequentially</em>, each one correcting the residual errors of those before it. Usually the top performer on tabular benchmarks and Kaggle leaderboards.</li>
</ul>
<div class="callout">💡 <span>Sensible default workflow for tabular data: <strong>logistic/linear baseline → random forest → gradient boosting</strong>. Reach for deep learning when data is images, audio, or text.</span></div>
<p>Ensembles trade away single-tree interpretability, but feature-importance scores and tools like SHAP recover much of the story.</p>`,
          takeaways: [
            "Decision trees: interpretable if/else splits, but single trees overfit.",
            "Random forest averages many decorrelated trees — robust, low-tuning.",
            "Boosting fits trees sequentially on previous errors — usually strongest on tabular data.",
            "Deep learning wins on perception (images/audio/text); trees rule spreadsheets.",
          ],
          quiz: [
            {
              q: "Why does a random forest overfit less than one deep tree?",
              options: [
                "It uses fewer total parameters",
                "Averaging many trees trained on different random subsets cancels their individual noise",
                "It refuses to split deeply",
                "It uses gradient descent",
              ],
              answer: 1,
              explain: "Each tree overfits differently; because their errors are decorrelated by randomness, the average is far more stable.",
            },
            {
              q: "The key difference between bagging and boosting?",
              options: [
                "Bagging trains trees in parallel independently; boosting trains sequentially, each fixing prior errors",
                "Bagging is only for regression",
                "Boosting uses neural networks",
                "There is no difference",
              ],
              answer: 0,
              explain: "Bagging = independent trees + averaging (variance reduction). Boosting = sequential error-correction (bias reduction).",
            },
            {
              q: "You have a 100k-row customer spreadsheet and need churn predictions fast. Best first serious model?",
              options: [
                "A transformer",
                "A convolutional neural network",
                "Gradient boosted trees",
                "k-means clustering",
              ],
              answer: 2,
              explain: "For tabular data, boosted trees (XGBoost/LightGBM) are the battle-tested default — strong accuracy with modest effort.",
            },
          ],
        },
      ],
    },
    {
      id: "ml-m3",
      title: "ML in the Wild",
      lessons: [
        {
          id: "ml-3-1",
          title: "Feature Engineering & Data Leakage",
          minutes: 14,
          content: `
<p>Ask senior ML engineers where models are won and lost, and the answer is rarely the algorithm — it's the <strong>features</strong>, and the silent killer called <strong>leakage</strong>.</p>
<h3>Features beat models</h3>
<p>A linear model with great features routinely beats a deep net with raw ones. The standard toolkit:</p>
<ul>
<li><strong>Categoricals</strong> — one-hot encode few categories; target/frequency encode many.</li>
<li><strong>Dates</strong> — raw timestamps are useless; day-of-week, hour, is-holiday, days-since-last-purchase are gold.</li>
<li><strong>Scaling</strong> — standardize features for distance- and gradient-based models (trees don't care).</li>
<li><strong>Domain ratios</strong> — debt/income says more than either number alone.</li>
</ul>
<h3>Leakage: the silent score-inflater</h3>
<p>Leakage = information from the future or from the answer sneaking into training features. The model looks brilliant offline and collapses in production.</p>
<pre><code>Target leakage    a feature recorded AFTER the outcome
                  ("days_in_hospital" when predicting admission)
Preprocessing     scaling/encoding fitted on ALL data before the split
Temporal          random split of time-series → training on the future
Group             same user in train AND test → memorization looks like skill</code></pre>
<h3>The defenses</h3>
<ol>
<li><strong>Split first.</strong> Fit every transform on training data only (pipelines enforce this).</li>
<li><strong>Time-aware splits</strong> for anything temporal: train on the past, test on the future.</li>
<li><strong>Interrogate every feature:</strong> "would I know this value at prediction time?"</li>
</ol>
<div class="callout">💡 <span>The smell test: if your score looks <strong>too good</strong>, it probably is. A 99% AUC on a hard problem is a leakage alarm, not a promotion.</span></div>`,
          takeaways: [
            "Feature quality usually matters more than model choice.",
            "Leakage = future/answer information in training features.",
            "Fit preprocessing on the training split only; use time-aware splits for temporal data.",
            "Ask of every feature: available at prediction time?",
          ],
          exercises: [
            {
              type: "match",
              title: "Diagnose the leakage",
              prompt: "Each scenario is a classic leak. Name it.",
              pairs: [
                ["Scaler fitted on the full dataset before splitting", "Preprocessing leakage"],
                ["Feature only recorded after the outcome happens", "Target leakage"],
                ["Random split of a time series", "Temporal leakage"],
                ["Same user's rows in both train and test", "Group contamination"],
              ],
            },
          ],
          quiz: [
            {
              q: "A fraud model scores 99.8% offline but fails in production. The MOST likely cause?",
              options: [
                "The model is too small",
                "Some form of data leakage inflated the offline score",
                "Production servers are slower",
                "Fraudsters read the paper",
              ],
              answer: 1,
              explain: "Massive offline/online gaps are leakage's signature — the model saw information at training time it can never have live.",
            },
            {
              q: "Why must a scaler be fitted only on the training split?",
              options: [
                "It's faster",
                "Fitting on all data lets test-set statistics leak into training",
                "Scalers break on large data",
                "The test set has different columns",
              ],
              answer: 1,
              explain: "Means/stds computed over the test rows carry information about them into training — a subtle but real contamination.",
            },
            {
              q: "For predicting next month's churn from user history, the correct split is…",
              options: [
                "Random 80/20",
                "Train on earlier time, test on later time",
                "Alphabetical by username",
                "No split needed",
              ],
              answer: 1,
              explain: "Production will always predict the future from the past. A random split trains on the future — pure temporal leakage.",
            },
          ],
        },
        {
          id: "ml-3-2",
          title: "From Notebook to Production",
          minutes: 13,
          content: `
<p>The industry's open secret: modeling is ~10% of a shipped ML system. The other 90% is engineering — and it's what separates a Kaggle hobbyist from a professional.</p>
<h3>Start with a baseline, always</h3>
<pre><code>predict the mean / majority class   → the floor
simple model (linear / small tree)  → the honest benchmark
fancy model                         → must beat both BY ENOUGH to justify itself</code></pre>
<p>A baseline takes ten minutes and saves months: if logistic regression gets 91% and the transformer gets 92%, ship the one you can debug at 3am.</p>
<h3>Pipelines: preprocessing is part of the model</h3>
<p>Production data arrives raw. Every transform (impute → encode → scale → predict) must be one saved artifact, fitted on training data, applied identically at serving time. Split-brain preprocessing — pandas in the notebook, hand-rewritten SQL in prod — is a classic source of silent failure.</p>
<h3>Serving and monitoring</h3>
<ul>
<li><strong>Batch</strong> (nightly scores) vs <strong>real-time</strong> (API) — choose by how fresh predictions must be.</li>
<li><strong>Data drift</strong> — input distributions shift (new user demographics). Monitor feature stats.</li>
<li><strong>Concept drift</strong> — the world changes meaning (fraud tactics evolve). Monitor live accuracy against ground truth as it arrives.</li>
<li><strong>Retraining</strong> — scheduled or drift-triggered; either way, automated and tested.</li>
</ul>
<div class="callout">💡 <span>Deployment isn't the finish line — it's the starting line. A model is a living system whose environment mutates under it. The ML lifecycle is a loop, not a pipeline.</span></div>`,
          takeaways: [
            "Baseline first: fancy models must beat simple ones by enough to earn their complexity.",
            "One pipeline artifact: preprocessing fitted on train, reused at serving.",
            "Monitor data drift (inputs) and concept drift (meaning) after launch.",
            "Retraining is part of the design, not an emergency response.",
          ],
          quiz: [
            {
              q: "Why build a trivial baseline before any serious model?",
              options: [
                "Managers require it",
                "It sets the floor that real models must meaningfully beat — and sometimes it's embarrassingly hard to beat",
                "Baselines train faster on GPUs",
                "It's only useful for competitions",
              ],
              answer: 1,
              explain: "Without a baseline, '92% accuracy' is uninterpretable. With one, you know whether complexity is buying anything.",
            },
            {
              q: "Your model's inputs still look normal, but accuracy on new labeled data keeps dropping. That's…",
              options: ["Data drift", "Concept drift", "A GPU failure", "Preprocessing leakage"],
              answer: 1,
              explain: "The relationship between features and target changed — the world moved. Inputs alone won't show it; live accuracy does.",
            },
            {
              q: "The notebook preprocesses with pandas; production re-implements it in SQL. The risk?",
              options: [
                "SQL is slower",
                "Subtle mismatches make serving-time inputs differ from training-time inputs, silently degrading predictions",
                "Pandas licenses cost money",
                "No risk if both are tested",
              ],
              answer: 1,
              explain: "Training/serving skew is a classic production killer. One shared pipeline artifact eliminates the entire bug class.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.push("ml");
