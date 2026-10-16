/**
 * typesetMath(el): renders \( \) and \[ \] with KaTeX auto-render (math track).
 * KaTeX loads deferred, so calls are queued until it is ready. Kept in a file
 * because the CSP disallows inline scripts.
 */

window.__mathQueue = [];
window.typesetMath = function (el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  } else {
    window.__mathQueue.push(el);
  }
};
window.addEventListener("load", function () {
  window.__mathQueue.splice(0).forEach(function (el) { window.typesetMath(el); });
});
