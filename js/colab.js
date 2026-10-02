/* ============================================
   1991 Academy — Google Colab
   Learners write and run their Python code in
   Google Colab, in their own browser. Every
   coding exercise has a notebook (task, starter code,
   tests, hints), written into assets/colab/ by
   tools/build_notebooks.py and served by this
   site: the learner downloads it and uploads it
   to Colab (File → Upload notebook), which
   keeps it in their own Google Drive. Nothing
   depends on GitHub.
   ============================================ */

const Colab = (() => {
  const COLAB = "https://colab.research.google.com/";

  const folder = () => (typeof I18N !== "undefined" && I18N.lang() === "hy" ? "hy" : "en");
  const file = (name) => name + ".ipynb";

  /* The steps under an exercise whose notebook is assets/colab/<en|hy>/<name>.ipynb */
  function panel(name, solved) {
    return (
      '<div class="colab-panel">' +
      '<ol class="colab-steps">' +
      "<li><p>" + t("Download the exercise's notebook:") + "</p>" +
      '<div class="colab-buttons"><a class="btn colab-download" href="/assets/colab/' + folder() + "/" + esc(file(name)) +
      '" download="' + esc(file(name)) + '">⬇ ' + esc(t("Download the notebook")) + "</a></div></li>" +
      "<li><p>" + t("Open Google Colab, choose <strong>File → Upload notebook</strong> and pick the file you downloaded ({0}). Colab saves it in your Google Drive, in the <em>Colab Notebooks</em> folder.", "<code>" + esc(file(name)) + "</code>") + "</p>" +
      '<div class="colab-buttons"><a class="btn colab-open" href="' + COLAB + '" target="_blank" rel="noopener">' +
      '<span class="colab-mark" aria-hidden="true">CO</span>' + esc(t("Open Google Colab")) + " ↗</a></div></li>" +
      "<li><p>" + t("Solve it there: run your code, then the test cell. When every test passes, come back here:") + "</p>" +
      '<div class="ex-actions">' +
      '<button class="btn btn-primary" data-solved' + (solved ? " disabled" : "") + ">" +
      (solved ? t("✓ solved") : t("I solved it ✓")) + "</button>" +
      '<span class="ex-status"></span></div></li>' +
      "</ol></div>"
    );
  }

  /* Hook up "I solved it" inside `root`; onSolved runs once, on the click. */
  function wire(root, onSolved) {
    const btn = root.querySelector("[data-solved]");
    const status = root.querySelector(".colab-panel .ex-status");
    if (!btn) return;
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = t("✓ solved");
      status.textContent = t("✓ Nice work — self-checked.");
      status.className = "ex-status ok";
      onSolved();
    });
  }

  return { panel, wire };
})();
