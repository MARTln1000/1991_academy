/* 1991 Academy — Homework problems for the Mathematics for ML track.
   Extracted from the FAST course problem sets (Homeworks 1-4, Linear
   Algebra module). Every answer below was verified numerically before
   publishing. type:"problem" = attempt on paper → reveal worked answer
   → self-check. LaTeX via String.raw so backslashes survive. */
(function () {
  const r = String.raw;
  const track = window.MARTINIUM.tracks.math;
  const byId = {};
  for (const m of track.modules) for (const l of m.lessons) byId[l.id] = l;

  const EX = {
    /* ---------- Lesson 1: Vectors, Matrices & Linear Systems ---------- */
    "math-1-1": [
      {
        type: "problem",
        title: "Matrix arithmetic",
        source: "HW 1 · Problem 1a",
        prompt: "Compute by hand, then check against the worked answer.",
        statement: r`<p>Let
\[ A = \begin{bmatrix} 3 & 0 \\ -1 & 5 \end{bmatrix},\quad
   B = \begin{bmatrix} 4 & -2 & 1 \\ 0 & 2 & 3 \end{bmatrix},\quad
   C = \begin{bmatrix} 1 & 2 \\ 3 & 4 \\ 5 & 6 \end{bmatrix}. \]
Compute \( AB + C^{T} \).</p>`,
        solution: r`<p>\( AB \) is \(2\times 3\): row \(i\) of \(A\) dotted with each column of \(B\):</p>
\[ AB = \begin{bmatrix} 12 & -6 & 3 \\ -4 & 12 & 14 \end{bmatrix}, \qquad
   C^{T} = \begin{bmatrix} 1 & 3 & 5 \\ 2 & 4 & 6 \end{bmatrix} \]
\[ AB + C^{T} = \begin{bmatrix} 13 & -3 & 8 \\ -2 & 16 & 20 \end{bmatrix} \]`,
      },
      {
        type: "problem",
        title: "Solve a linear system by elimination",
        source: "HW 1 · Problem 3a",
        prompt: "Use Gaussian (or Gauss–Jordan) elimination on paper.",
        statement: r`<p>Solve the system
\[ \begin{cases} x_1 + 2x_2 - 3x_3 = 9 \\ 2x_1 - 2x_2 + x_3 = 0 \\ 4x_1 - x_2 + x_3 = 4 \end{cases} \]</p>`,
        solution: r`<p>Eliminate \(x_1\): \(R_2 \leftarrow R_2 - 2R_1\), \(R_3 \leftarrow R_3 - 4R_1\):</p>
\[ \begin{cases} x_1 + 2x_2 - 3x_3 = 9 \\ -6x_2 + 7x_3 = -18 \\ -9x_2 + 13x_3 = -32 \end{cases} \]
<p>Then \(R_3 \leftarrow R_3 - \tfrac{3}{2}R_2\) gives \(\tfrac{5}{2}x_3 = -5\), so \(x_3 = -2\).
Back-substitute: \(-6x_2 + 7(-2) = -18 \Rightarrow x_2 = \tfrac{2}{3}\), and finally
\(x_1 = 9 - 2x_2 + 3x_3 = 9 - \tfrac{4}{3} - 6 = \tfrac{5}{3}\).</p>
\[ \boxed{\;x_1 = \tfrac{5}{3},\quad x_2 = \tfrac{2}{3},\quad x_3 = -2\;} \]
<p>Check in equation 2: \(2\cdot\tfrac{5}{3} - 2\cdot\tfrac{2}{3} + (-2) = \tfrac{10-4}{3} - 2 = 0\) ✓</p>`,
      },
    ],

    /* ---------- Lesson 2: Systems, Determinants & Vector Spaces ---------- */
    "math-1-2": [
      {
        type: "problem",
        title: "A 3×3 determinant",
        source: "HW 2 · Problem 1a",
        prompt: "Expand along a row or column of your choice.",
        statement: r`<p>Calculate the determinant of
\[ \begin{bmatrix} 6 & 1 & 1 \\ 4 & -2 & 5 \\ 2 & 8 & 7 \end{bmatrix}. \]</p>`,
        solution: r`<p>Cofactor expansion along the first row:</p>
\[ 6\begin{vmatrix} -2 & 5 \\ 8 & 7 \end{vmatrix}
 - 1\begin{vmatrix} 4 & 5 \\ 2 & 7 \end{vmatrix}
 + 1\begin{vmatrix} 4 & -2 \\ 2 & 8 \end{vmatrix} \]
\[ = 6(-14 - 40) - (28 - 10) + (32 + 4) = -324 - 18 + 36 = \boxed{-306} \]
<p>Since \(\det \neq 0\), the matrix is invertible and its columns are linearly independent.</p>`,
      },
      {
        type: "problem",
        title: "Which sets are subspaces?",
        source: "HW 1 · Problem 5",
        prompt: "Test the subspace axioms: contains 0, closed under + and scalar ×.",
        statement: r`<p>Which of the following are subspaces of \( \mathbb{R}^3 \)?</p>
\[ A = \left\{ \left(\lambda,\; \lambda + \mu^3,\; \lambda - \mu^3\right) : \lambda, \mu \in \mathbb{R} \right\} \]
\[ B = \left\{ (x_1, x_2, x_3) : x_1 - 2x_2 + 3x_3 = 1 \right\} \]
\[ C = \left\{ (x_1, x_2, x_3) : x_2 \in \mathbb{Z} \right\} \]`,
        solution: r`<p><strong>A — yes.</strong> As \(\mu\) runs over \(\mathbb{R}\), \(t = \mu^3\) also takes every real value, so
\(A = \{\lambda(1,1,1) + t(0,1,-1)\}\) — the span of two vectors, hence a subspace (a plane through the origin).</p>
<p><strong>B — no.</strong> The zero vector fails the equation (\(0 \neq 1\)); a subspace must contain \(\mathbf{0}\). (It's an affine plane, not a linear one.)</p>
<p><strong>C — no.</strong> Not closed under scalar multiplication: \((0,1,0) \in C\) but \(\tfrac12(0,1,0) = (0,\tfrac12,0) \notin C\).</p>`,
      },
    ],

    /* ---------- Lesson 3: Independence, Basis, Rank ---------- */
    "math-1-3": [
      {
        type: "problem",
        title: "When do vectors become dependent?",
        source: "HW 2 · Problem 2",
        prompt: "Express the condition as a determinant in the coordinates w.r.t. b₁, b₂, b₃.",
        statement: r`<p>Let \( \mathbf{b}_1, \mathbf{b}_2, \mathbf{b}_3 \in \mathbb{R}^n \) be linearly independent and
\[ \mathbf{x}_1 = 2\mathbf{b}_1 + 3\mathbf{b}_2 - \mathbf{b}_3,\quad
   \mathbf{x}_2 = \mathbf{b}_1 - 2\mathbf{b}_2 + 2\mathbf{b}_3,\quad
   \mathbf{x}_3 = \mathbf{b}_1 - 9\mathbf{b}_2 + a\,\mathbf{b}_3. \]
For which value of \(a\) are \( \mathbf{x}_1, \mathbf{x}_2, \mathbf{x}_3 \) linearly dependent?</p>`,
        solution: r`<p>Because the \(\mathbf{b}_i\) are independent, dependence of the \(\mathbf{x}_i\) is dependence of their coordinate vectors:</p>
\[ \det\begin{bmatrix} 2 & 1 & 1 \\ 3 & -2 & -9 \\ -1 & 2 & a \end{bmatrix} = 0 \]
<p>Expanding: \(\det = -7a + 49\) (compute it yourself as practice). Setting \(-7a + 49 = 0\):</p>
\[ \boxed{a = 7} \]`,
      },
      {
        type: "problem",
        title: "Rank by row reduction",
        source: "HW 2 · Problem 5",
        prompt: "Row-reduce and count the pivots.",
        statement: r`<p>Find the rank of
\[ A = \begin{bmatrix} 0 & 1 & 1 & 2 \\ 1 & 3 & -1 & 2 \\ 2 & 5 & -3 & 2 \end{bmatrix}, \qquad
   B = \begin{bmatrix} 1 & 2 \\ 2 & 4 \\ 3 & 7 \\ 3 & 9 \end{bmatrix}. \]</p>`,
        solution: r`<p><strong>A:</strong> swap rows so a pivot leads: \(R_3 \leftarrow R_3 - 2R_2\) gives \((0,-1,-1,-2)\), which is exactly \(-R_1\) — one row dies. Two pivots survive:
\[ \operatorname{rank} A = 2 \]
<strong>B:</strong> \(R_2 = 2R_1\) dies; \(R_3, R_4\) are not multiples of \(R_1\) but \(R_4 - R_3 = (0,2)\) and \(R_3 - 3R_1 = (0,1)\) — a second independent direction and no more (only 2 columns!):
\[ \operatorname{rank} B = 2 \]
<p>Rank can never exceed \(\min(\text{rows}, \text{columns})\).</p>`,
      },
    ],

    /* ---------- Lesson 4: Mappings & Norms ---------- */
    "math-1-4": [
      {
        type: "problem",
        title: "L1 and L2 norms",
        source: "HW 2 · Problem 8",
        prompt: "Manhattan = sum of absolute values; Euclidean = square root of the sum of squares.",
        statement: r`<p>Find the Manhattan (\(\ell_1\)) and Euclidean (\(\ell_2\)) norms of
\[ \mathbf{x} = \begin{bmatrix} 1 \\ 1 \\ 1 \end{bmatrix},\quad
   \mathbf{y} = \begin{bmatrix} 1 \\ 0 \\ -1 \end{bmatrix},\quad
   \mathbf{z} = \begin{bmatrix} 12 \\ -3 \\ 4 \end{bmatrix}. \]</p>`,
        solution: r`\[ \|\mathbf{x}\|_1 = 3, \qquad \|\mathbf{x}\|_2 = \sqrt{3} \]
\[ \|\mathbf{y}\|_1 = 2, \qquad \|\mathbf{y}\|_2 = \sqrt{2} \]
\[ \|\mathbf{z}\|_1 = 12 + 3 + 4 = 19, \qquad \|\mathbf{z}\|_2 = \sqrt{144 + 9 + 16} = \sqrt{169} = 13 \]
<p>Note how the \(\ell_1\) norm punishes \( \mathbf{z} \)'s large coordinate less dramatically than the squared terms inside \(\ell_2\) do — the geometric root of why L1 and L2 regularization behave differently.</p>`,
      },
      {
        type: "problem",
        title: "Coordinates in a new basis",
        source: "HW 2 · Problem 7",
        prompt: "Write x as a combination of the basis vectors — that means solving a linear system.",
        statement: r`<p>Determine the coordinate vector of \( \mathbf{x} \) with respect to the ordered basis \(B\) of \( \mathbb{R}^4 \):</p>
\[ \mathbf{x} = \begin{bmatrix} 1 \\ 2 \\ -2 \\ 1 \end{bmatrix},\quad
B = \left\{
\begin{bmatrix} 1 \\ 0 \\ 0 \\ 1 \end{bmatrix},
\begin{bmatrix} 1 \\ -2 \\ -1 \\ 1 \end{bmatrix},
\begin{bmatrix} 0 \\ 0 \\ -2 \\ -1 \end{bmatrix},
\begin{bmatrix} -1 \\ 3 \\ 0 \\ -1 \end{bmatrix}
\right\} \]`,
        solution: r`<p>Solve \( c_1\mathbf{b}_1 + c_2\mathbf{b}_2 + c_3\mathbf{b}_3 + c_4\mathbf{b}_4 = \mathbf{x} \). Row 2 gives \(-2c_2 + 3c_4 = 2\); row 3 gives \(-c_2 - 2c_3 = -2\); rows 1 and 4 give \(c_1 + c_2 - c_4 = 1\) and \(c_1 + c_2 - c_3 - c_4 = 1\). Subtracting the last two: \(c_3 = 0\), hence \(c_2 = 2\), hence \(c_4 = 2\), hence \(c_1 = 1\).</p>
\[ [\mathbf{x}]_B = \boxed{(1,\; 2,\; 0,\; 2)} \]
<p>Same vector, different description — coordinates are always <em>relative to a basis</em>.</p>`,
      },
    ],

    /* ---------- Lesson 5: Orthogonality, Projections, PD matrices ---------- */
    "math-1-5": [
      {
        type: "problem",
        title: "Spot the positive-definite matrix",
        source: "HW 3 · Problem 2",
        prompt: "Use leading principal minors (Sylvester's criterion) — no eigenvalues needed.",
        statement: r`<p>Which of the following matrices is positive definite?</p>
\[ A = \begin{bmatrix} 5 & -2 \\ -2 & 1 \end{bmatrix}, \qquad
   B = \begin{bmatrix} 6 & -3 \\ -3 & 1 \end{bmatrix} \]`,
        solution: r`<p>For a symmetric \(2\times2\) matrix, positive definite \(\iff\) both leading minors are positive.</p>
<p><strong>A:</strong> \(a_{11} = 5 > 0\) and \(\det A = 5 - 4 = 1 > 0\) → <strong>positive definite ✓</strong></p>
<p><strong>B:</strong> \(b_{11} = 6 > 0\) but \(\det B = 6 - 9 = -3 < 0\) → indefinite (one negative eigenvalue) ✗</p>
<p>PD matrices are exactly the ones that define valid inner products \( \langle x, y\rangle = x^T M y \) — and the "bowl-shaped" quadratics optimization loves.</p>`,
      },
      {
        type: "problem",
        title: "Projection onto a line",
        source: "HW 3 · Problem 7",
        prompt: r`The projection matrix onto span{b} is P = bbᵀ / (bᵀb).`,
        statement: r`<p>Find the projection matrix \(P_\pi\) onto the line through the origin spanned by
\( \mathbf{b} = [1,\; 2,\; -4]^T \), and the projection of \( \mathbf{x} = [2,\; 3,\; 1]^T \).</p>`,
        solution: r`<p>\( \mathbf{b}^T\mathbf{b} = 1 + 4 + 16 = 21 \), so</p>
\[ P_\pi = \frac{\mathbf{b}\mathbf{b}^T}{\mathbf{b}^T\mathbf{b}}
 = \frac{1}{21}\begin{bmatrix} 1 & 2 & -4 \\ 2 & 4 & -8 \\ -4 & -8 & 16 \end{bmatrix} \]
<p>For the projection: \( \mathbf{b}^T\mathbf{x} = 2 + 6 - 4 = 4 \), so</p>
\[ P_\pi\mathbf{x} = \frac{4}{21}\,\mathbf{b} = \frac{1}{21}\begin{bmatrix} 4 \\ 8 \\ -16 \end{bmatrix} \]
<p>This "closest point on a line" computation is least-squares regression in its smallest possible form.</p>`,
      },
    ],

    /* ---------- Lesson 6: Trace & Eigenvalues ---------- */
    "math-1-6": [
      {
        type: "problem",
        title: "Eigenvalues without computing anything",
        source: "HW 4 · Problem 2",
        prompt: "Everything follows from the definition Av = λv — no characteristic polynomial grinding.",
        statement: r`<p>Let \( A \in \mathbb{R}^{3\times3} \) satisfy
\[ A\mathbf{v}_1 = 3\mathbf{v}_1, \quad A\mathbf{v}_2 = 5\mathbf{v}_2, \quad A\mathbf{v}_3 = -\mathbf{v}_3 \]
for nonzero \( \mathbf{v}_i \). Determine the eigenvalues, the characteristic polynomial, \(\det A\) and \(\operatorname{tr} A\). What is the characteristic polynomial of \(A^T\)?</p>`,
        solution: r`<p>The equations say directly: eigenvalues \( \{3, 5, -1\} \) (three distinct ones — that's all a \(3\times3\) can have).</p>
\[ p(\lambda) = (\lambda - 3)(\lambda - 5)(\lambda + 1) \]
\[ \det A = 3 \cdot 5 \cdot (-1) = -15 \qquad (\text{product of eigenvalues}) \]
\[ \operatorname{tr} A = 3 + 5 - 1 = 7 \qquad (\text{sum of eigenvalues}) \]
<p>\(A^T\) has the <em>same</em> characteristic polynomial: \(\det(A^T - \lambda I) = \det\big((A-\lambda I)^T\big) = \det(A - \lambda I)\).</p>`,
      },
      {
        type: "problem",
        title: "Eigenvalues & eigenspaces of a triangular matrix",
        source: "HW 3 · Problem 8 / HW 4 · Problem 1",
        prompt: "Triangular matrix → eigenvalues on the diagonal. Then find each eigenspace and compare multiplicities.",
        statement: r`<p>Find the eigenvalues and eigenspaces of
\[ A = \begin{bmatrix} 2 & 3 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & 5 \end{bmatrix}, \]
and give the algebraic and geometric multiplicity of each eigenvalue.</p>`,
        solution: r`<p>Triangular ⇒ eigenvalues are the diagonal: \( \lambda = 2 \) (algebraic multiplicity 2) and \( \lambda = 5 \) (multiplicity 1).</p>
<p><strong>λ = 2:</strong> \( A - 2I = \begin{bmatrix} 0 & 3 & 0 \\ 0 & 0 & 0 \\ 0 & 0 & 3 \end{bmatrix} \) forces \(x_2 = x_3 = 0\):
eigenspace \( \operatorname{span}\{(1,0,0)\} \) — <strong>geometric multiplicity 1 &lt; algebraic 2</strong>.</p>
<p><strong>λ = 5:</strong> \( A - 5I \) forces \(x_1 = x_2 = 0\): eigenspace \( \operatorname{span}\{(0,0,1)\} \), multiplicities 1 = 1.</p>
<p>Because one eigenvalue is "missing" an eigenvector, this matrix is <em>not diagonalizable</em> — the classic defective case.</p>`,
      },
    ],

    /* ---------- Lesson 7: Eigendecomposition & SVD ---------- */
    "math-1-7": [
      {
        type: "problem",
        title: "Eigendecomposition of a symmetric matrix",
        source: "HW 4 · Problem 5",
        prompt: "Characteristic polynomial → eigenvalues → eigenvectors → A = QΛQᵀ.",
        statement: r`<p>Compute the eigendecomposition of
\[ A = \begin{bmatrix} 0 & 4 \\ 4 & 6 \end{bmatrix}. \]</p>`,
        solution: r`<p>\( \det(A - \lambda I) = \lambda^2 - 6\lambda - 16 = (\lambda - 8)(\lambda + 2) \): eigenvalues \( 8 \) and \( -2 \).</p>
<p><strong>λ = 8:</strong> \( (A - 8I)\mathbf{v} = 0 \Rightarrow -8v_1 + 4v_2 = 0 \Rightarrow \mathbf{v} = \tfrac{1}{\sqrt5}(1, 2) \)</p>
<p><strong>λ = −2:</strong> \( 2v_1 + 4v_2 = 0 \Rightarrow \mathbf{v} = \tfrac{1}{\sqrt5}(-2, 1) \)</p>
\[ A = Q \Lambda Q^T, \quad
Q = \frac{1}{\sqrt5}\begin{bmatrix} 1 & -2 \\ 2 & 1 \end{bmatrix}, \quad
\Lambda = \begin{bmatrix} 8 & 0 \\ 0 & -2 \end{bmatrix} \]
<p>Symmetric matrix ⇒ orthonormal eigenvectors (check: the two vectors are perpendicular) — the spectral theorem at work.</p>`,
      },
      {
        type: "problem",
        title: "SVD of a symmetric matrix",
        source: "HW 4 · Problem 6a",
        prompt: "For symmetric A, singular values are |eigenvalues| — watch what happens to the negative one.",
        statement: r`<p>Find the singular value decomposition of
\[ A = \begin{bmatrix} 1 & 3 \\ 3 & 1 \end{bmatrix}. \]</p>`,
        solution: r`<p>Eigenvalues: \( \det(A - \lambda I) = (1-\lambda)^2 - 9 = 0 \Rightarrow \lambda = 4, -2 \), with orthonormal eigenvectors
\( \mathbf{q}_1 = \tfrac{1}{\sqrt2}(1,1) \) and \( \mathbf{q}_2 = \tfrac{1}{\sqrt2}(1,-1) \).</p>
<p>Singular values are the absolute values, ordered: \( \sigma_1 = 4, \sigma_2 = 2 \). The negative eigenvalue flips its output direction: \( A\mathbf{q}_2 = -2\mathbf{q}_2 = \sigma_2(-\mathbf{q}_2) \), so \( \mathbf{u}_2 = -\mathbf{q}_2 \).</p>
\[ A = U\Sigma V^T,\quad
U = \frac{1}{\sqrt2}\begin{bmatrix} 1 & -1 \\ 1 & 1 \end{bmatrix},\;
\Sigma = \begin{bmatrix} 4 & 0 \\ 0 & 2 \end{bmatrix},\;
V = \frac{1}{\sqrt2}\begin{bmatrix} 1 & 1 \\ 1 & -1 \end{bmatrix} \]
<p>Check: \( U\Sigma V^T = \begin{bmatrix} 1 & 3 \\ 3 & 1 \end{bmatrix} \) ✓ — rotate, stretch by (4, 2), rotate.</p>`,
      },
    ],
  };

  for (const [id, exercises] of Object.entries(EX)) {
    if (byId[id]) byId[id].exercises = exercises;
  }

  /* ---------- Course materials: FAST slides + homework PDFs ----------
     Local copies live in assets/courses/math (site is USB-independent).
     Module 1 lessons ↔ "Linear Algebra N.pdf"; later modules ↔ LectureN. */
  const A = "../assets/courses/math/";
  track.modules.forEach((mod, mi) => {
    mod.lessons.forEach((lesson, li) => {
      const slide =
        mi === 0 ? "Linear Algebra " + (li + 1) + ".pdf"
        : mi === 1 ? "Lecture" + (8 + li) + ".pdf"
        : mi === 2 ? "Lecture" + (15 + li) + ".pdf"
        : "Lecture" + (20 + li) + ".pdf";
      lesson.materials = [{ label: "Slides: " + slide.replace(".pdf", ""), href: A + "Slides/" + slide }];
    });
  });
  const HW = { "math-1-1": 1, "math-1-2": 1, "math-1-3": 2, "math-1-4": 2, "math-1-5": 3, "math-1-6": 4, "math-1-7": 4 };
  for (const [id, n] of Object.entries(HW)) {
    if (byId[id]) byId[id].materials.push({ label: "Problem set: Homework " + n + " (PDF)", href: A + "Homeworks/Homework " + n + ".pdf" });
  }
})();
