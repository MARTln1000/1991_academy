/* 1991 Academy track: Mathematics for Machine Learning.
   Lecture videos from the Foundation for Armenian Science and Technology
   (FAST) "Mathematics | Lectures" course, wrapped with written maps,
   takeaways and active-recall quizzes. */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

var FAST = "FAST Foundation";
var LEC = "full lecture";

window.MARTINIUM.tracks.math = {
  id: "math",
  title: "Mathematics for ML",
  tagline: "The linear algebra, calculus and probability every model is built on — full university lectures, mapped and quizzed.",
  icon: "🧮",
  accent: "#818cf8",
  accentSoft: "rgba(129, 140, 248, 0.14)",
  modules: [
    {
      id: "math-m1",
      title: "Linear Algebra",
      lessons: [
        {
          id: "math-1-1",
          title: "Vectors, Matrices & Linear Systems",
          minutes: 9,
          videos: [{ id: "gC3qXcGPkR4", title: "Lecture 1 | Vectors, Matrices and System of Linear Equations", channel: FAST, length: LEC }],
          content: `
<p>Linear algebra is the language machine learning speaks. A dataset is a matrix — rows are examples, columns are features — and almost every model is, at heart, matrices acting on vectors.</p>
<h3>The two ways to read Ax = b</h3>
<ul>
<li><strong>Row view:</strong> each row of A is one linear equation; the solution x satisfies all of them at once (where the lines/planes intersect).</li>
<li><strong>Column view:</strong> Ax is a <em>combination</em> of A's columns weighted by x. Solving Ax = b asks: "what mix of these column-vectors produces b?"</li>
</ul>
<p>The column view is the one that pays off in ML — it turns "solve a system" into "reach a target by combining building blocks," which is exactly what a linear layer does.</p>
<div class="callout">💡 <span>A vector is both an arrow in space and a list of numbers. Fluency means switching between the two pictures without thinking.</span></div>`,
          takeaways: [
            "Data is a matrix: rows = examples, columns = features.",
            "Ax = b has a row view (intersecting equations) and a column view (combining columns).",
            "The column view — Ax as a weighted sum of columns — underlies linear layers.",
          ],
          quiz: [
            {
              q: "In the 'column picture' of Ax = b, the product Ax is…",
              options: [
                "The determinant of A times x",
                "A linear combination of A's columns, weighted by the entries of x",
                "The dot product of every row with itself",
                "Always equal to b",
              ],
              answer: 1,
              explain: "Ax mixes the columns of A using x's entries as weights — solving asks which mix reproduces b.",
            },
            {
              q: "In a typical ML design matrix, what does a single row represent?",
              options: ["One feature across all examples", "One training example's features", "The labels", "The weights"],
              answer: 1,
              explain: "Convention: rows are examples (samples), columns are features.",
            },
          ],
        },
        {
          id: "math-1-2",
          title: "Solving Systems, Determinants & Vector Spaces",
          minutes: 9,
          videos: [{ id: "kL4MFqI5j58", title: "Lecture 2 | System of Linear Equations, Determinant & Vector Spaces", channel: FAST, length: LEC }],
          content: `
<p>Gaussian elimination is the workhorse for solving Ax = b: use row operations to reach a triangular form, then back-substitute. Every linear solver and least-squares fit descends from this idea.</p>
<h3>The determinant, intuitively</h3>
<p>The determinant of a square matrix is the <strong>volume-scaling factor</strong> of the transformation it represents. det = 0 means the map collapses space into a lower dimension — the matrix is <em>singular</em>, and the system has no unique solution.</p>
<h3>Vector spaces</h3>
<p>A vector space is any set closed under addition and scalar multiplication. The abstraction matters because functions, images, and embeddings all live in vector spaces — so the same machinery applies everywhere.</p>
<div class="callout">💡 <span>det = 0 is the algebraic version of "these directions are redundant" — the same collapse that makes a model unidentifiable.</span></div>`,
          takeaways: [
            "Gaussian elimination + back-substitution solves linear systems systematically.",
            "The determinant is the volume-scaling factor; det = 0 means singular (no unique solution).",
            "Vector spaces generalize 'vectors' to functions, images and embeddings.",
          ],
          quiz: [
            {
              q: "A square matrix has determinant 0. What does that tell you?",
              options: [
                "It has an inverse",
                "Its transformation collapses volume — it's singular and not invertible",
                "The system always has exactly one solution",
                "All its entries are zero",
              ],
              answer: 1,
              explain: "Zero determinant = the map flattens space, so the matrix is singular and can't be inverted.",
            },
            {
              q: "Gaussian elimination transforms a system into which convenient form?",
              options: ["Diagonal by eigenvalues", "Upper-triangular, then back-substitute", "A single scalar", "Its transpose"],
              answer: 1,
              explain: "Row operations reach triangular form, from which back-substitution reads off the solution.",
            },
          ],
        },
        {
          id: "math-1-3",
          title: "Independence, Basis, Rank & Mappings",
          minutes: 9,
          videos: [{ id: "k2kIarxDx9M", title: "Lecture 3 | Linear Independence, Basis, Rank & Linear Mappings", channel: FAST, length: LEC }],
          content: `
<p>These four ideas describe how much "real" information a set of vectors or a matrix carries.</p>
<ul>
<li><strong>Linear independence:</strong> no vector in the set is a combination of the others — none is redundant.</li>
<li><strong>Basis:</strong> a minimal independent set that spans the whole space. Coordinates are just the weights to rebuild a vector from the basis.</li>
<li><strong>Rank:</strong> the number of independent columns (= independent rows). It's the true dimensionality of what a matrix can produce.</li>
<li><strong>Linear mapping:</strong> a function that respects addition and scaling; every one is represented by a matrix.</li>
</ul>
<p>In ML, rank tells you about redundancy: low-rank structure is why compression, PCA and efficient fine-tuning (LoRA) all work.</p>
<div class="callout">💡 <span>Rank = how many genuinely different directions survive the transformation. Redundant features lower it.</span></div>`,
          takeaways: [
            "Independent vectors carry non-redundant information; a basis is a minimal spanning set.",
            "Rank = number of independent columns = true output dimensionality of a matrix.",
            "Low-rank structure powers PCA, compression and LoRA fine-tuning.",
          ],
          quiz: [
            {
              q: "A 5×5 matrix has rank 3. What does that mean?",
              options: [
                "It has 3 rows",
                "Its outputs span only a 3-dimensional subspace — two directions are redundant",
                "Its determinant is 3",
                "It has 3 eigenvalues equal to 1",
              ],
              answer: 1,
              explain: "Rank 3 means only 3 independent directions survive; the map can't reach the full 5-D space.",
            },
            {
              q: "A basis for a vector space is…",
              options: [
                "Any large set of vectors",
                "A minimal set of independent vectors that spans the space",
                "The set of all eigenvectors",
                "The rows of the identity matrix only",
              ],
              answer: 1,
              explain: "A basis is independent (nothing redundant) and spanning (reaches everything) — minimal by definition.",
            },
          ],
        },
        {
          id: "math-1-4",
          title: "Linear Mappings & Norms",
          minutes: 8,
          videos: [{ id: "d6TH5wJ4lcQ", title: "Lecture 4 | Linear Mappings & Norm", channel: FAST, length: LEC }],
          content: `
<p>A <strong>norm</strong> measures the length of a vector — and therefore distance, error and size throughout ML.</p>
<ul>
<li><strong>L2 (Euclidean):</strong> sqrt of sum of squares. The default; behind mean-squared error and ridge regularization.</li>
<li><strong>L1 (Manhattan):</strong> sum of absolute values. Encourages <em>sparsity</em> — the reason lasso zeroes out features.</li>
<li><strong>L∞:</strong> the largest single component.</li>
</ul>
<p>Every loss function is, in some sense, a norm of the error vector. Choosing a norm is choosing what "being wrong" costs.</p>
<div class="callout">💡 <span>L2 spreads error smoothly; L1 pushes weights to exactly zero. That single difference is why lasso does feature selection and ridge doesn't.</span></div>`,
          takeaways: [
            "A norm turns a vector into a length — the basis of distance and error.",
            "L2 underlies MSE and ridge; L1 induces sparsity (lasso).",
            "Choosing a loss is choosing a norm on the error.",
          ],
          quiz: [
            {
              q: "Which norm tends to drive weights to exactly zero, performing feature selection?",
              options: ["L2 (Euclidean)", "L1 (Manhattan)", "L∞ (max)", "None do"],
              answer: 1,
              explain: "L1's geometry has corners on the axes, so the optimum often lands with components exactly zero — sparsity.",
            },
            {
              q: "Mean squared error is most closely tied to which norm of the error vector?",
              options: ["L1", "L2 (squared)", "L∞", "L0"],
              answer: 1,
              explain: "MSE sums squared errors — the squared L2 norm of the residual vector.",
            },
          ],
        },
        {
          id: "math-1-5",
          title: "Orthogonality, Projections & Positive-Definite Matrices",
          minutes: 9,
          videos: [{ id: "zrU0pAV1M5Q", title: "Lecture 5 | Positive Definite Matrices, Metrics, Orthogonality and Projections", channel: FAST, length: LEC }],
          content: `
<p>Two vectors are <strong>orthogonal</strong> when their dot product is zero — they share no component. Orthogonality makes math clean: independent directions, stable numerics, decorrelated features.</p>
<h3>Projection</h3>
<p>Projecting b onto a subspace finds the closest point in it to b. <strong>Least-squares regression is exactly this</strong>: the prediction is the projection of the targets onto the column space of the features, and the residual is orthogonal to that space.</p>
<h3>Positive-definite matrices</h3>
<p>A symmetric matrix is positive-definite if x·Mx &gt; 0 for all nonzero x — it defines a bowl-shaped quadratic with a unique minimum. Covariance matrices and well-behaved loss curvatures are positive-(semi)definite, which is what guarantees optimization has somewhere to descend to.</p>
<div class="callout">💡 <span>Least squares = orthogonal projection. The "best fit" is the shadow the target casts on the space your features can reach.</span></div>`,
          takeaways: [
            "Orthogonal (dot product 0) = no shared direction; the key to clean decompositions.",
            "Least-squares regression is the orthogonal projection of targets onto feature space.",
            "Positive-definite matrices give bowl-shaped objectives with a unique minimum.",
          ],
          quiz: [
            {
              q: "Least-squares regression can be understood geometrically as…",
              options: [
                "Rotating the data",
                "Projecting the target vector orthogonally onto the span of the features",
                "Inverting the covariance matrix",
                "Maximizing the determinant",
              ],
              answer: 1,
              explain: "The fitted values are the closest point in feature-space to the targets — an orthogonal projection; the residual is perpendicular.",
            },
            {
              q: "Two nonzero vectors are orthogonal when their dot product is…",
              options: ["Maximal", "Zero", "Negative", "One"],
              answer: 1,
              explain: "A zero dot product means no shared component — the defining condition of orthogonality.",
            },
          ],
        },
        {
          id: "math-1-6",
          title: "Trace & Eigenvalues",
          minutes: 9,
          videos: [{ id: "FE63WxVxjK0", title: "Lecture 6 | Trace & Eigenvalues", channel: FAST, length: LEC }],
          content: `
<p>An <strong>eigenvector</strong> of a matrix is a direction that the matrix only stretches, never rotates: Av = λv. The scalar λ is the <strong>eigenvalue</strong> — how much that direction is scaled.</p>
<p>Eigenvalues expose the intrinsic behavior of a transformation:</p>
<ul>
<li>Their product equals the determinant (total volume scaling).</li>
<li>Their sum equals the <strong>trace</strong> (the diagonal sum) — a cheap invariant.</li>
<li>Signs of eigenvalues tell you whether a critical point is a minimum, maximum, or saddle.</li>
</ul>
<p>In ML they are everywhere: principal components are eigenvectors of the covariance matrix, and the eigenvalues of the loss's Hessian govern how hard it is to optimize.</p>
<div class="callout">💡 <span>Eigenvectors are the directions a matrix leaves alone (up to scale). Find them and a messy transformation becomes simple stretching.</span></div>`,
          takeaways: [
            "Av = λv: eigenvectors are stretched-not-rotated directions; λ is the stretch.",
            "Sum of eigenvalues = trace; product = determinant.",
            "PCA directions are covariance eigenvectors; Hessian eigenvalues shape optimization.",
          ],
          quiz: [
            {
              q: "If Av = λv with v nonzero, then v is…",
              options: ["An eigenvalue", "An eigenvector, scaled by λ under A", "The determinant", "Always zero"],
              answer: 1,
              explain: "v is the eigenvector; A only stretches it by the eigenvalue λ, no rotation.",
            },
            {
              q: "The trace of a matrix equals…",
              options: ["The product of eigenvalues", "The sum of eigenvalues (and of the diagonal)", "The largest eigenvalue", "The determinant"],
              answer: 1,
              explain: "Trace = sum of diagonal entries = sum of eigenvalues; the determinant is their product.",
            },
          ],
        },
        {
          id: "math-1-7",
          title: "Eigendecomposition, Diagonalization & SVD",
          minutes: 10,
          videos: [{ id: "dKVTU4Khsa4", title: "Lecture 7 | Eigendecomposition, Diagonalization & Singular Value Decomposition", channel: FAST, length: LEC }],
          content: `
<p>The payoff of the module. <strong>Eigendecomposition</strong> rewrites a matrix as "rotate → stretch along axes → rotate back," making powers, inverses and dynamics easy in the right coordinates.</p>
<h3>SVD: the master factorization</h3>
<p>The Singular Value Decomposition, A = UΣVᵀ, works for <em>any</em> matrix — rectangular, non-invertible, anything. It expresses A as a sum of rank-1 pieces ordered by importance (the singular values in Σ).</p>
<p>Keep only the top few singular values and you get the <strong>best low-rank approximation</strong> — the mathematical engine behind PCA, image compression, latent semantic analysis and recommender systems. It is arguably the single most useful factorization in applied ML.</p>
<div class="callout">💡 <span>SVD says every linear map is "rotate, scale, rotate." Truncating the small scales keeps the signal and drops the noise — that's dimensionality reduction.</span></div>`,
          takeaways: [
            "Eigendecomposition diagonalizes a matrix into rotate–stretch–rotate.",
            "SVD (A = UΣVᵀ) works for any matrix and orders structure by singular value.",
            "Truncated SVD = best low-rank approximation → PCA, compression, recommenders.",
          ],
          quiz: [
            {
              q: "A key advantage of the SVD over eigendecomposition is that it…",
              options: [
                "Is faster to compute always",
                "Applies to any matrix, including non-square and non-invertible ones",
                "Never uses rotations",
                "Only works on symmetric matrices",
              ],
              answer: 1,
              explain: "Eigendecomposition needs a (diagonalizable) square matrix; SVD factors absolutely any matrix.",
            },
            {
              q: "Keeping only the largest singular values of A gives you…",
              options: [
                "A larger matrix",
                "The best low-rank approximation of A (the basis of PCA/compression)",
                "The inverse of A",
                "A random projection",
              ],
              answer: 1,
              explain: "Truncated SVD is provably the best low-rank approximation — signal kept, small components dropped.",
            },
          ],
        },
      ],
    },
    {
      id: "math-m2",
      title: "Calculus & Optimization",
      lessons: [
        {
          id: "math-2-1",
          title: "Limits of Sequences",
          minutes: 8,
          videos: [{ id: "MGgLRVTmMZQ", title: "Lecture 8 | Limit of a Sequence", channel: FAST, length: LEC }],
          content: `
<p>A <strong>limit</strong> formalizes "gets arbitrarily close to." A sequence converges to L if, past some point, every term stays within any tolerance you name of L.</p>
<p>This is the bedrock of everything that follows: derivatives are limits, integrals are limits, and — directly relevant — <strong>training convergence</strong> is the statement that a sequence of loss values approaches a limit. When we say "the model converged," we mean exactly this.</p>
<div class="callout">💡 <span>Every "→ 0" you see in a loss curve is a limit claim. Understanding convergence rates is understanding why one optimizer beats another.</span></div>`,
          takeaways: [
            "A limit is the value a sequence gets and stays arbitrarily close to.",
            "Derivatives and integrals are both defined as limits.",
            "'Training converged' is literally: the loss sequence approaches a limit.",
          ],
          quiz: [
            {
              q: "Saying a training run 'converged' is, mathematically, a claim that…",
              options: [
                "The model has zero parameters",
                "The sequence of loss values approaches a limit",
                "The learning rate is zero",
                "The dataset is infinite",
              ],
              answer: 1,
              explain: "Convergence = the loss sequence settling toward a limiting value; that's the limit concept in action.",
            },
            {
              q: "Which concepts are defined using limits?",
              options: ["Only derivatives", "Only integrals", "Both derivatives and integrals", "Neither"],
              answer: 2,
              explain: "The derivative is a limit of difference quotients; the integral is a limit of sums. Limits underlie both.",
            },
          ],
        },
        {
          id: "math-2-2",
          title: "Limits of Functions & Continuity",
          minutes: 8,
          videos: [{ id: "kbtAZUEdXRg", title: "Lecture 9 | Limit of a Function & Continuity", channel: FAST, length: LEC }],
          content: `
<p>A function is <strong>continuous</strong> if small input changes cause small output changes — no jumps. Continuity is the well-behavedness that lets optimization work: you can nudge parameters and trust the loss moves predictably.</p>
<p>It also explains activation choices. A step function is discontinuous and gives no gradient; smooth activations like sigmoid and tanh — and the (continuous, if kinked) ReLU — keep the network trainable. Differentiability, coming next, is a stronger cousin of continuity.</p>
<div class="callout">💡 <span>Discontinuities are where gradients die. Much of deep-learning engineering is keeping the loss landscape smooth enough to descend.</span></div>`,
          takeaways: [
            "Continuous = small input change → small output change (no jumps).",
            "Continuity is why gradient-based optimization behaves predictably.",
            "Smooth/continuous activations keep networks trainable; hard steps kill gradients.",
          ],
          quiz: [
            {
              q: "Why are smooth activation functions preferred over a hard step function?",
              options: [
                "They look nicer",
                "A step is discontinuous and gives no usable gradient to train with",
                "Steps are slower to compute",
                "They use less memory",
              ],
              answer: 1,
              explain: "Gradient descent needs the output to change smoothly with inputs; a discontinuous step provides no gradient signal.",
            },
            {
              q: "A continuous function is one where…",
              options: [
                "The graph has jumps",
                "Small changes in input produce small changes in output — no breaks",
                "The derivative is always zero",
                "It is always increasing",
              ],
              answer: 1,
              explain: "Continuity means no jumps: nearby inputs map to nearby outputs.",
            },
          ],
        },
        {
          id: "math-2-3",
          title: "Derivatives & Extrema",
          minutes: 9,
          videos: [{ id: "5dBj_tmVI44", title: "Lecture 10 | Derivative & Extrema", channel: FAST, length: LEC }],
          content: `
<p>The <strong>derivative</strong> is the instantaneous rate of change — the slope of the tangent line. It answers "if I nudge the input, which way and how fast does the output move?" That is precisely the question every training step asks.</p>
<h3>Finding extrema</h3>
<p>At a maximum or minimum of a smooth function, the derivative is <strong>zero</strong> (a flat tangent). Setting the derivative to zero locates candidate optima; the second derivative tells you which kind — positive curvature is a minimum, negative a maximum.</p>
<p>Gradient descent is this idea run backwards: instead of solving derivative = 0 analytically, follow the slope downhill step by step.</p>
<div class="callout">💡 <span>Minimizing a loss = finding where its derivative is zero and curvature is positive. Gradient descent just walks there.</span></div>`,
          takeaways: [
            "The derivative is the slope — the direction and rate the output changes.",
            "Extrema occur where the derivative is zero; the second derivative classifies them.",
            "Gradient descent follows the slope downhill instead of solving derivative = 0.",
          ],
          quiz: [
            {
              q: "At a smooth function's minimum, its first derivative is…",
              options: ["Maximal", "Zero", "Undefined", "Negative"],
              answer: 1,
              explain: "A minimum has a flat tangent — derivative zero; positive second derivative confirms it's a min.",
            },
            {
              q: "The derivative of a loss with respect to a weight tells you…",
              options: [
                "The final accuracy",
                "How and how fast the loss changes as you nudge that weight",
                "The number of epochs left",
                "The batch size",
              ],
              answer: 1,
              explain: "It's the local slope — the exact information gradient descent uses to update the weight.",
            },
          ],
        },
        {
          id: "math-2-4",
          title: "Integrals & Taylor Series",
          minutes: 9,
          videos: [{ id: "eEEM7rxcv1w", title: "Lecture 11 | Integrals & Taylor Series", channel: FAST, length: LEC }],
          content: `
<p><strong>Integration</strong> accumulates — area under a curve, total from a rate. In probability it's how continuous distributions turn densities into probabilities (the area under the density over an interval).</p>
<h3>Taylor series</h3>
<p>A Taylor series approximates a complicated function near a point by a polynomial built from its derivatives: value + slope·Δ + ½·curvature·Δ² + … Truncating after the first couple of terms gives the <strong>local linear/quadratic model</strong> that optimization methods rely on — gradient descent uses the linear term, Newton's method adds the quadratic one.</p>
<div class="callout">💡 <span>Taylor expansion is why a smooth loss looks like a bowl up close. Optimizers exploit that local bowl to decide their next step.</span></div>`,
          takeaways: [
            "Integration accumulates a rate into a total / area — and gives probabilities from densities.",
            "Taylor series approximate a function locally using its derivatives.",
            "First-order Taylor = gradient descent's model; second-order = Newton's method.",
          ],
          quiz: [
            {
              q: "For a continuous probability distribution, the probability of landing in an interval is…",
              options: [
                "The height of the density there",
                "The integral (area) of the density over that interval",
                "Always 1",
                "The derivative of the density",
              ],
              answer: 1,
              explain: "Continuous probabilities are areas under the density — integrals over the interval.",
            },
            {
              q: "A first-order Taylor approximation of a loss around a point uses…",
              options: [
                "Only the value",
                "The value plus the gradient (linear term) — exactly what gradient descent steps along",
                "Only the second derivative",
                "The integral",
              ],
              answer: 1,
              explain: "First order keeps value + slope; gradient descent moves opposite that gradient.",
            },
          ],
        },
        {
          id: "math-2-5",
          title: "Series & Convergence of Integrals",
          minutes: 8,
          videos: [{ id: "aLVvXVM2iOg", title: "Lecture 12 | Series & Integrals", channel: FAST, length: LEC }],
          content: `
<p>A <strong>series</strong> is an infinite sum. Whether it converges (adds up to something finite) or diverges is a recurring practical question: it governs whether an infinite-horizon expected reward is finite, whether a kernel sum is well defined, and whether iterative schemes settle.</p>
<p>The same convergence lens applies to improper integrals — sums and integrals are two faces of accumulation. The habit to build: before trusting an infinite process, ask whether it converges at all.</p>
<div class="callout">💡 <span>Discounted returns in reinforcement learning are a geometric series — they converge precisely because the discount factor is below 1.</span></div>`,
          takeaways: [
            "A series is an infinite sum; convergence decides if it totals something finite.",
            "Series and improper integrals are two forms of accumulation with the same convergence questions.",
            "RL's discounted return converges only because the discount factor is < 1.",
          ],
          quiz: [
            {
              q: "Reinforcement learning discounts future rewards by γ < 1 largely because…",
              options: [
                "It makes rewards bigger",
                "It turns the infinite reward sum into a convergent (finite) geometric series",
                "γ has no effect on convergence",
                "It removes the need for a value function",
              ],
              answer: 1,
              explain: "A geometric series with ratio γ < 1 converges; that keeps the infinite-horizon return finite and well defined.",
            },
            {
              q: "Before trusting an infinite sum or improper integral, you should first check…",
              options: ["Its derivative", "Whether it converges at all", "Its determinant", "Its rank"],
              answer: 1,
              explain: "A divergent series/integral has no finite value — convergence must be established first.",
            },
          ],
        },
        {
          id: "math-2-6",
          title: "Gradients, the Chain Rule & Multivariate Limits",
          minutes: 10,
          videos: [{ id: "MstQyxQ0LFo", title: "Lecture 13 | Gradients, Chain Rule & Limit of Multivariate Function", channel: FAST, length: LEC }],
          content: `
<p>Real models have many parameters, so the derivative generalizes to the <strong>gradient</strong>: the vector of partial derivatives. It points in the direction of steepest increase — so its negative is the steepest way <em>down</em>, which is the entire premise of gradient descent.</p>
<h3>The chain rule</h3>
<p>Composed functions have composed derivatives: the rate through a chain is the product of the local rates. For a deep network — functions stacked on functions — the chain rule is the only tractable way to get gradients, and applied systematically it <strong>is backpropagation</strong>.</p>
<div class="callout">💡 <span>Gradient = steepest-ascent direction. Backprop = the chain rule bookkept efficiently from the loss back to every weight.</span></div>`,
          takeaways: [
            "The gradient is the vector of partial derivatives — steepest-ascent direction.",
            "Gradient descent steps along the negative gradient.",
            "The chain rule composes derivatives through layers; applied systematically it is backpropagation.",
          ],
          quiz: [
            {
              q: "The gradient of a scalar loss over its parameters points in the direction of…",
              options: [
                "Steepest decrease of the loss",
                "Steepest increase of the loss (so we step opposite it)",
                "Zero change",
                "The largest parameter",
              ],
              answer: 1,
              explain: "The gradient points uphill; descent moves along its negative to reduce the loss.",
            },
            {
              q: "Backpropagation is essentially…",
              options: [
                "The product rule applied once",
                "The chain rule applied systematically from the loss back through every layer",
                "A way to initialize weights",
                "Numerical integration",
              ],
              answer: 1,
              explain: "Backprop is the multivariate chain rule, bookkept efficiently to get every parameter's gradient.",
            },
          ],
        },
        {
          id: "math-2-7",
          title: "Multivariate Extrema & Gradient Descent",
          minutes: 10,
          videos: [{ id: "g7vxUX24Lhg", title: "Lecture 14 | Differential, Extrema, Gradient Descent & Intro to Probability", channel: FAST, length: LEC }],
          content: `
<p>Optimizing many variables at once: at an extremum the gradient is the zero vector, and the <strong>Hessian</strong> (matrix of second derivatives) plays the role of curvature. Positive-definite Hessian → local minimum; indefinite → a saddle point, the shape that dominates high-dimensional loss landscapes.</p>
<h3>Gradient descent, formally</h3>
<pre><code>repeat:  θ ← θ − η · ∇L(θ)</code></pre>
<p>Step opposite the gradient, scaled by learning rate η. Everything you met in the ML and DL tracks — momentum, Adam, learning-rate schedules — are refinements of this one update, now on rigorous footing. This lecture also bridges into probability, the next module.</p>
<div class="callout">💡 <span>In high dimensions, most critical points are saddles, not minima — which is why escaping them (via momentum, noise) matters more than people expect.</span></div>`,
          takeaways: [
            "Multivariate extrema: gradient = 0; the Hessian's definiteness classifies the point.",
            "Saddle points dominate high-dimensional landscapes.",
            "θ ← θ − η·∇L is gradient descent; Adam, momentum and schedules refine it.",
          ],
          quiz: [
            {
              q: "In the update θ ← θ − η·∇L(θ), the symbol η is…",
              options: ["The gradient", "The learning rate (step size)", "The loss", "The Hessian"],
              answer: 1,
              explain: "η scales the step taken opposite the gradient — the learning rate.",
            },
            {
              q: "In high-dimensional loss surfaces, most points where the gradient vanishes are…",
              options: ["Global minima", "Saddle points, not minima", "Maxima", "Discontinuities"],
              answer: 1,
              explain: "High dimensions make saddles overwhelmingly common; navigating them is a real optimization challenge.",
            },
          ],
        },
      ],
    },
    {
      id: "math-m3",
      title: "Probability & Statistics",
      lessons: [
        {
          id: "math-3-1",
          title: "Probability, Bayes' Rule & Random Variables",
          minutes: 10,
          videos: [{ id: "XRt0vXgBAsU", title: "Lecture 15 | Probability, Conditional Probability, Independence, Bayes, Random Variables", channel: FAST, length: LEC }],
          content: `
<p>Probability is the mathematics of uncertainty — and machine learning is uncertainty management. A <strong>random variable</strong> maps outcomes to numbers; its distribution says how likely each is.</p>
<h3>Conditioning and Bayes' rule</h3>
<p>Conditional probability P(A|B) updates belief about A once B is known. <strong>Bayes' rule</strong> inverts it:</p>
<pre><code>P(H | data) = P(data | H) · P(H) / P(data)</code></pre>
<p>Posterior ∝ likelihood × prior. This is the skeleton of Naive Bayes classifiers, Bayesian inference, and the very idea of "updating a model from evidence." <strong>Independence</strong> — when P(A,B) = P(A)P(B) — is the simplifying assumption that makes many models tractable.</p>
<div class="callout">💡 <span>Bayes' rule is how a rational agent changes its mind: new belief ∝ how well the hypothesis predicted the data × how plausible it was to begin with.</span></div>`,
          takeaways: [
            "A random variable maps outcomes to numbers; its distribution gives their likelihoods.",
            "Bayes' rule: posterior ∝ likelihood × prior — the math of updating beliefs.",
            "Independence, P(A,B)=P(A)P(B), is the assumption that simplifies many models.",
          ],
          quiz: [
            {
              q: "Bayes' rule expresses the posterior P(H|data) as proportional to…",
              options: [
                "P(H) only",
                "likelihood P(data|H) times prior P(H)",
                "P(data) alone",
                "1 minus the prior",
              ],
              answer: 1,
              explain: "Posterior ∝ likelihood × prior — evidence reweights your prior belief.",
            },
            {
              q: "Events A and B are independent when…",
              options: ["P(A|B) = 0", "P(A,B) = P(A)·P(B)", "A and B never co-occur", "P(A) = P(B)"],
              answer: 1,
              explain: "Independence means the joint factorizes into the product of marginals; knowing B tells you nothing about A.",
            },
          ],
        },
        {
          id: "math-3-2",
          title: "Trials, Expected Value & Variance",
          minutes: 9,
          videos: [{ id: "HYpct-AD15w", title: "Lecture 16 | Trials, Expected Value & Variance", channel: FAST, length: LEC }],
          content: `
<p>The <strong>expected value</strong> is the long-run average of a random variable — the probability-weighted mean. Nearly every ML loss is an expectation ("expected error over the data distribution"), and training estimates it with sample averages.</p>
<h3>Variance</h3>
<p>Variance measures spread — how far outcomes typically fall from the mean. It's the statistical half of the <strong>bias–variance tradeoff</strong>, and it's why a mini-batch gradient (an average over samples) is a noisy estimate whose variance shrinks as the batch grows.</p>
<div class="callout">💡 <span>Loss = expected error. A mini-batch is a sample estimate of that expectation; larger batches cut its variance but cost more per step.</span></div>`,
          takeaways: [
            "Expected value = probability-weighted average; ML losses are expectations.",
            "Variance measures spread and drives the bias–variance tradeoff.",
            "A mini-batch gradient is a noisy sample estimate whose variance falls as batch size grows.",
          ],
          quiz: [
            {
              q: "Most ML loss functions are, formally, a(n)…",
              options: [
                "Determinant of the data",
                "Expected value (average) of a per-example error",
                "Maximum single error",
                "Variance only",
              ],
              answer: 1,
              explain: "Losses are expectations of per-example error; training approximates them with sample averages.",
            },
            {
              q: "Increasing the mini-batch size affects the gradient estimate by…",
              options: [
                "Increasing its variance",
                "Reducing its variance (a less noisy estimate)",
                "Making it biased",
                "Nothing",
              ],
              answer: 1,
              explain: "Averaging over more samples lowers the estimate's variance — smoother but costlier gradients.",
            },
          ],
        },
        {
          id: "math-3-3",
          title: "Continuous Random Variables & Covariance",
          minutes: 9,
          videos: [{ id: "ZqvepWHlLxo", title: "Lecture 17 | Continuous Random Variables, Covariance & Sequence of Functions", channel: FAST, length: LEC }],
          content: `
<p>Continuous variables are described by a <strong>probability density</strong>; probabilities are areas under it (integration returns). The Gaussian — the bell curve — is the workhorse: it appears in noise models, initializations and priors, largely thanks to the Central Limit Theorem.</p>
<h3>Covariance</h3>
<p><strong>Covariance</strong> measures how two variables move together; normalized, it becomes correlation. Stack it up and you get the <strong>covariance matrix</strong>, whose eigenvectors are the principal components. Feature correlation is exactly the redundancy PCA removes — connecting probability straight back to the linear-algebra module.</p>
<div class="callout">💡 <span>The covariance matrix is where probability meets linear algebra: its eigen-structure is PCA, and it defines the shape of a multivariate Gaussian.</span></div>`,
          takeaways: [
            "Continuous variables use densities; probabilities are integrals (areas) under them.",
            "The Gaussian is central to noise, initialization and priors.",
            "Covariance measures joint variation; its matrix's eigenvectors are the PCA directions.",
          ],
          quiz: [
            {
              q: "The eigenvectors of the covariance matrix are exactly…",
              options: [
                "The data labels",
                "The principal components (PCA directions)",
                "The gradients",
                "The support vectors",
              ],
              answer: 1,
              explain: "PCA diagonalizes the covariance matrix; its eigenvectors are the principal component directions.",
            },
            {
              q: "For a continuous random variable, the density function gives probability via…",
              options: [
                "Its value directly at a point",
                "The area under it over an interval (an integral)",
                "Its derivative",
                "Its maximum",
              ],
              answer: 1,
              explain: "A single point has zero probability; intervals get probability from the area (integral) under the density.",
            },
          ],
        },
        {
          id: "math-3-4",
          title: "Convergence of Random Variables",
          minutes: 8,
          videos: [{ id: "Dzc7CDoA4Rk", title: "Lecture 18 | Sequence of Functions, Power Series & Convergence of Random Variables", channel: FAST, length: LEC }],
          content: `
<p>What does it mean for a sequence of <em>random</em> quantities to converge? There are several notions (in probability, almost surely, in distribution), and the distinctions matter for guarantees about estimators.</p>
<p>The practical upshot: as you gather more data, well-designed estimators converge to the truth. This is the theoretical promise underneath "more data helps" — it's not folklore, it's a convergence theorem. Power series, revisited here, also underpin how many distributions and generating functions are analyzed.</p>
<div class="callout">💡 <span>Different modes of convergence are different strengths of promise that your estimate approaches the true value as data grows.</span></div>`,
          takeaways: [
            "Random variables can converge in several senses (in probability, almost surely, in distribution).",
            "Well-designed estimators converge to the truth as data grows — a theorem, not folklore.",
            "These modes set the strength of statistical guarantees.",
          ],
          quiz: [
            {
              q: "The idea that a good estimator approaches the true value as data grows is…",
              options: [
                "An unprovable heuristic",
                "A convergence result (e.g., consistency) for random variables",
                "True only for linear models",
                "Only about variance",
              ],
              answer: 1,
              explain: "Consistency is precisely convergence of the estimator (a random variable) to the true parameter as n grows.",
            },
            {
              q: "Why distinguish different modes of convergence for random variables?",
              options: [
                "They are all identical",
                "They give different strengths of guarantee about approaching the true value",
                "Only to make exams harder",
                "They apply only to sequences of matrices",
              ],
              answer: 1,
              explain: "In-probability, almost-sure and in-distribution convergence carry different guarantees, which matters for theory.",
            },
          ],
        },
        {
          id: "math-3-5",
          title: "Law of Large Numbers & the Central Limit Theorem",
          minutes: 9,
          videos: [{ id: "d42PJv0_uqA", title: "Lecture 19 | Law of Large Numbers, Central Limit Theorem, Joint Distribution", channel: FAST, length: LEC }],
          content: `
<p>Two theorems that quietly justify most of applied statistics and ML.</p>
<ul>
<li><strong>Law of Large Numbers:</strong> the sample average converges to the true mean as samples grow. This is why a test-set metric estimates true performance, and why Monte Carlo methods work.</li>
<li><strong>Central Limit Theorem:</strong> sums/averages of many independent variables become approximately <strong>Gaussian</strong>, whatever the original distribution. This is why the bell curve is everywhere, why error bars and confidence intervals are valid, and why Gaussian noise assumptions are so often reasonable.</li>
</ul>
<p>Together with <strong>joint distributions</strong> (how multiple variables co-vary), these close the probability module and connect back to evaluation and uncertainty throughout the site.</p>
<div class="callout">💡 <span>LLN says averages are trustworthy; CLT says their error is Gaussian. Together they license test-set evaluation, confidence intervals and A/B tests.</span></div>`,
          takeaways: [
            "Law of Large Numbers: sample averages converge to the true mean (why test metrics work).",
            "Central Limit Theorem: averages of many independent variables become approximately Gaussian.",
            "Together they justify confidence intervals, error bars and A/B testing.",
          ],
          quiz: [
            {
              q: "Why can a test-set average estimate a model's true performance?",
              options: [
                "The Central Limit Theorem makes it exact",
                "The Law of Large Numbers: sample averages converge to the true mean",
                "Because test sets are always huge",
                "It can't — it's a guess",
              ],
              answer: 1,
              explain: "LLN guarantees the sample mean approaches the true expectation as the sample grows.",
            },
            {
              q: "The Central Limit Theorem explains why…",
              options: [
                "All data is Gaussian",
                "Averages/sums of many independent variables are approximately Gaussian, enabling confidence intervals",
                "Variance is always zero",
                "Models never overfit",
              ],
              answer: 1,
              explain: "The CLT makes sampling distributions of averages approximately normal, which is what confidence intervals rely on.",
            },
          ],
        },
      ],
    },
    {
      id: "math-m4",
      title: "Signals & Fourier",
      lessons: [
        {
          id: "math-4-1",
          title: "Signal Processing, the Fourier Transform & Sampling",
          minutes: 9,
          videos: [{ id: "5iZ2cSvh5Pw", title: "Lecture 20 | Introduction to Signal Processing, Fourier Transform & Sampling Theorem", channel: FAST, length: LEC }],
          content: `
<p>The <strong>Fourier transform</strong> rewrites a signal as a sum of sine waves — swapping the time view for the frequency view. Whatever is tangled in time often becomes simple in frequency, which is why it is foundational for audio, images and time series.</p>
<h3>The sampling theorem</h3>
<p>Nyquist–Shannon says you can perfectly reconstruct a signal from samples only if you sample at more than twice its highest frequency. Under-sample and you get <strong>aliasing</strong> — the distortion behind moiré patterns and the reason audio uses 44.1 kHz. Any ML on sensor, audio or image data lives with these limits.</p>
<div class="callout">💡 <span>Time and frequency are two views of the same signal. Convolutions (the C in CNN) are simple multiplications in the frequency domain.</span></div>`,
          takeaways: [
            "The Fourier transform expresses a signal as a sum of frequencies (time ↔ frequency).",
            "Nyquist: sample above twice the max frequency or suffer aliasing.",
            "Convolution in time is multiplication in frequency — linking to CNNs.",
          ],
          quiz: [
            {
              q: "The Fourier transform converts a signal from…",
              options: [
                "Frequency domain to spatial domain only",
                "The time domain to the frequency domain (as a sum of sine waves)",
                "Analog to digital",
                "Vectors to matrices",
              ],
              answer: 1,
              explain: "It decomposes a time signal into its constituent frequencies — the frequency-domain view.",
            },
            {
              q: "The Nyquist sampling theorem requires sampling at a rate…",
              options: [
                "Equal to the highest frequency",
                "Greater than twice the highest frequency, else aliasing occurs",
                "Below the highest frequency",
                "Exactly once per second",
              ],
              answer: 1,
              explain: "Perfect reconstruction needs a sample rate above twice the max frequency; under-sampling causes aliasing.",
            },
          ],
        },
        {
          id: "math-4-2",
          title: "Fourier Series & the Discrete Fourier Transform",
          minutes: 9,
          videos: [{ id: "9ZoMg5D0k2M", title: "Lecture 21 | Fourier Series & Discrete Fourier Transform", channel: FAST, length: LEC }],
          content: `
<p>The <strong>Fourier series</strong> represents any periodic function as a sum of sinusoids. The <strong>Discrete Fourier Transform (DFT)</strong> is the version for sampled data, and the <strong>FFT</strong> computes it in O(n log n) — one of the most important algorithms ever written.</p>
<p>In practice the DFT/FFT turns raw audio into spectrograms (the standard input to speech models), powers fast convolution, and drives spectral feature extraction. It's the bridge from continuous theory to what actually runs on arrays of numbers.</p>
<div class="callout">💡 <span>The FFT's O(n log n) speed is what makes real-time audio ML, spectrograms and fast convolutions practical at all.</span></div>`,
          takeaways: [
            "Fourier series: any periodic function is a sum of sinusoids.",
            "The DFT is the sampled-data version; the FFT computes it in O(n log n).",
            "DFT/FFT produce spectrograms and enable fast convolution — core to audio ML.",
          ],
          quiz: [
            {
              q: "The FFT is important primarily because it…",
              options: [
                "Is exact while the DFT is approximate",
                "Computes the DFT in O(n log n) instead of O(n²), making spectral methods practical",
                "Works only on images",
                "Removes all noise",
              ],
              answer: 1,
              explain: "The FFT is a fast algorithm for the DFT; its O(n log n) cost unlocks real-time spectral processing.",
            },
            {
              q: "A spectrogram, a common input to speech models, is produced using…",
              options: ["Matrix inversion", "The Fourier/DFT of the audio signal", "Gradient descent", "A determinant"],
              answer: 1,
              explain: "Spectrograms come from applying the (short-time) Fourier transform to audio.",
            },
          ],
        },
        {
          id: "math-4-3",
          title: "The Short-Time Fourier Transform",
          minutes: 8,
          videos: [{ id: "CZ617goowDo", title: "Lecture 22 | Short Time Fourier Transform", channel: FAST, length: LEC }],
          content: `
<p>A plain Fourier transform tells you <em>which</em> frequencies are present but not <em>when</em> — useless for signals that change over time, like speech or music. The <strong>Short-Time Fourier Transform (STFT)</strong> fixes this: slide a window across the signal and take the Fourier transform of each chunk, producing a time–frequency map.</p>
<p>That map is the <strong>spectrogram</strong> — the image that convolutional and transformer speech models actually consume. There's a fundamental tradeoff (the uncertainty principle): narrow windows give sharp timing but blurry frequency, and vice versa. Choosing the window is a real modeling decision.</p>
<div class="callout">💡 <span>The STFT is how modern audio ML turns sound into an image — after which the whole computer-vision toolkit applies.</span></div>`,
          takeaways: [
            "The STFT adds time localization by Fourier-transforming sliding windows.",
            "Its output is the spectrogram — the standard input to audio models.",
            "Time vs. frequency resolution trade off via the window size (uncertainty principle).",
          ],
          quiz: [
            {
              q: "The STFT improves on the plain Fourier transform by revealing…",
              options: [
                "Only the loudest frequency",
                "When each frequency occurs (time localization), not just which frequencies exist",
                "The signal's average",
                "The determinant of the signal",
              ],
              answer: 1,
              explain: "By transforming short windows, the STFT shows how the frequency content changes over time.",
            },
            {
              q: "The time–frequency tradeoff in the STFT is controlled mainly by…",
              options: ["The sample values", "The analysis window size", "The learning rate", "The number of channels"],
              answer: 1,
              explain: "Window size trades timing precision against frequency precision — the uncertainty principle in practice.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.unshift("math");
