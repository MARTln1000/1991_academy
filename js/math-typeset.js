/* ============================================
   1991 Academy — math typesetting (math track only)
   typesetMath(el): render \( \) and \[ \] via KaTeX
   auto-render. KaTeX loads deferred, after track.js
   runs, so queue until it's ready. A file rather than
   an inline <script>: the CSP allows no inline scripts.
   ============================================ */

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
