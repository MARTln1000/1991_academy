/**
 * Privacy page: shows the policy in the current UI language.
 */

(function () {
  const lang = I18N.lang() === "hy" ? "hy" : "en";
  document.querySelectorAll("[data-policy-lang]").forEach((el) => {
    el.hidden = el.dataset.policyLang !== lang;
  });
  document.title = (lang === "hy" ? "Գաղտնիության քաղաքականություն" : "Privacy Policy") + " — 1991 Academy";
  renderStreakPill();
  XP.renderPill();
})();
