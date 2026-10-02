/* ============================================
   1991 Academy — Privacy Policy page
   privacy.html holds the policy in English and
   Armenian; show the one the site is in.
   ============================================ */

(function () {
  const lang = I18N.lang() === "hy" ? "hy" : "en";
  document.querySelectorAll("[data-policy-lang]").forEach((el) => {
    el.hidden = el.dataset.policyLang !== lang;
  });
  document.title = (lang === "hy" ? "Գաղտնիության քաղաքականություն" : "Privacy Policy") + " — 1991 Academy";
  renderStreakPill();
  XP.renderPill();
})();
