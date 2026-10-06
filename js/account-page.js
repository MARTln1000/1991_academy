/* ============================================
   1991 Academy — Account page
   Sign in when logged out (there is no sign-up:
   the school invites its students), profile +
   security controls when logged in, the
   password-reset landing (?reset=TOKEN) and the
   invitation landing (?welcome=TOKEN).
   ============================================ */

(async function () {
  const root = document.getElementById("account-root");
  await Auth.ready;

  function fmtDate(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /* ---------- Offline: no server behind this page ---------- */

  function renderOffline() {
    root.innerHTML =
      '<div class="practice-card practice-done">' +
      '<div class="p-big">🔌</div>' +
      "<h2>" + t("Accounts need the 1991 Academy server") + "</h2>" +
      '<p>' + t("This page was opened without the backend, so sign-in is unavailable (your progress still saves on this device). To enable accounts, run this in the 1991 Academy folder:") + "</p>" +
      '<pre style="display:inline-block; text-align:left; background:#0d1017; color:#dbe2f0; ' +
      'padding:14px 20px; border-radius:12px; font-family:var(--font-mono); font-size:0.85rem">.venv/bin/python app.py\n# then open http://localhost:8735</pre>' +
      "</div>";
  }

  /* ---------- Logged in: profile + security ---------- */

  function renderProfile() {
    const u = Auth.current();
    const level = XP.levelInfo();
    const streak = Progress.getStreak();
    root.innerHTML =
      '<div class="form-card profile-card">' +
      '<div class="profile-head">' +
      '<div class="avatar">' + esc(u.username[0].toUpperCase()) + "</div>" +
      "<div><h2>" + esc(u.username) + "</h2>" +
      '<p class="f-sub" style="margin:0">' + esc(u.email) + " · " + t("member since {0}", fmtDate(u.created)) + "</p></div></div>" +
      '<div class="hero-stats" style="margin:22px 0">' +
      '<div class="stat-chip"><strong>' + XP.total() + " XP</strong><span>" + t("Level {0} · {1}", level.level, t(level.name)) + "</span></div>" +
      '<div class="stat-chip"><strong>' + t(streak === 1 ? "{0} day" : "{0} days", streak) + "</strong><span>" + t("current streak") + "</span></div>" +
      "</div>" +
      '<p class="f-sub">' + t("Your progress syncs to your account automatically, moments after each change. Sign in from any device to pick up where you left off. After signing out, a local copy stays on this device.") + "</p>" +
      '<label class="lb-opt"><input type="checkbox" data-lb-opt' + (u.leaderboardOptIn ? " checked" : "") + " /> " +
      t("Show me on the leaderboard") + "</label>" +
      '<div class="dash-actions">' +
      '<button class="btn btn-primary" data-sync>' + t("⟳ Sync now") + "</button>" +
      '<button class="btn" data-signout>' + t("Sign out") + "</button>" +
      "</div>" +
      '<p class="form-error" data-msg></p></div>' +

      /* --- change password --- */
      '<form class="form-card profile-card" data-form="changepw">' +
      "<h3>" + t("Change password") + "</h3>" +
      '<div class="field"><label for="cp-cur">' + t("Current password") + "</label>" +
      '<input id="cp-cur" name="currentPassword" type="password" autocomplete="current-password" required /></div>' +
      '<div class="field"><label for="cp-new">' + t("New password (min 8 characters)") + "</label>" +
      '<input id="cp-new" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<button class="btn" type="submit">' + t("Update password") + "</button>" +
      '<p class="form-error" data-cp-msg></p></form>' +

      /* --- danger zone --- */
      '<div class="form-card profile-card danger-zone">' +
      "<h3>" + t("Danger zone") + "</h3>" +
      '<p class="f-sub">' + t("Deleting your account permanently removes it and your synced progress from the server. This cannot be undone.") + "</p>" +
      '<button class="btn btn-danger" data-del-open>' + t("Delete account") + "</button>" +
      '<form data-form="delete" hidden style="margin-top:14px">' +
      '<div class="field"><label for="del-pw">' + t("Type your password to confirm") + "</label>" +
      '<input id="del-pw" name="password" type="password" autocomplete="current-password" required /></div>' +
      '<div class="dash-actions">' +
      '<button class="btn btn-danger" type="submit">' + t("Yes, delete my account") + "</button>" +
      '<button class="btn" type="button" data-del-cancel>' + t("Cancel") + "</button>" +
      "</div><p class=\"form-error\" data-del-msg></p></form></div>";

    const msg = root.querySelector("[data-msg]");

    root.querySelector("[data-sync]").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await Auth.syncNow();
        msg.style.color = "var(--success)";
        msg.textContent = t("✓ Synced at {0}", new Date().toLocaleTimeString());
      } catch (err) {
        msg.style.color = "";
        msg.textContent = t("Sync failed: {0}", err.message);
      }
      e.target.disabled = false;
    });

    root.querySelector("[data-signout]").addEventListener("click", async () => {
      await Auth.logout();
      render();
    });

    root.querySelector("[data-lb-opt]").addEventListener("change", async (e) => {
      e.target.disabled = true;
      try {
        await Auth.setLeaderboardOptIn(e.target.checked);
      } catch {
        e.target.checked = !e.target.checked; // server said no — show the truth
        msg.style.color = "";
        msg.textContent = t("Couldn't save that — check your connection.");
      } finally {
        e.target.disabled = false;
      }
    });

    /* change password */
    const cpForm = root.querySelector("[data-form=changepw]");
    const cpMsg = cpForm.querySelector("[data-cp-msg]");
    cpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      cpMsg.style.color = "";
      cpMsg.textContent = "";
      const btn = cpForm.querySelector("button");
      btn.disabled = true;
      const f = new FormData(cpForm);
      try {
        await Auth.changePassword(f.get("currentPassword"), f.get("newPassword"));
        cpForm.reset();
        cpMsg.style.color = "var(--success)";
        cpMsg.textContent = t("✓ Password updated. Other devices were signed out.");
      } catch (err) {
        cpMsg.textContent = err.message;
      }
      btn.disabled = false;
    });

    /* delete account */
    const delForm = root.querySelector("[data-form=delete]");
    const delMsg = delForm.querySelector("[data-del-msg]");
    root.querySelector("[data-del-open]").addEventListener("click", (e) => {
      e.target.hidden = true;
      delForm.hidden = false;
    });
    delForm.querySelector("[data-del-cancel]").addEventListener("click", () => {
      delForm.hidden = true;
      root.querySelector("[data-del-open]").hidden = false;
    });
    delForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      delMsg.textContent = "";
      const btn = delForm.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await Auth.deleteAccount(new FormData(delForm).get("password"));
        root.innerHTML =
          '<div class="practice-card practice-done"><div class="p-big">👋</div>' +
          "<h2>" + t("Account deleted") + "</h2>" +
          "<p>" + t("Your account and synced progress are gone. This device's local progress remains.") + "</p>" +
          '<a class="btn btn-primary" href="index.html">' + t("Home") + "</a></div>";
      } catch (err) {
        delMsg.textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  /* ---------- Signed out: one centred page for sign-in, invitations and
     new passwords. There is no sign-up: the school creates its students'
     accounts and sends each an invitation link. ---------- */

  function authPage(inner, below) {
    return (
      '<div class="auth-center">' +
      '<div class="auth-brand"><span class="logo-mark">1991</span>1991 Academy</div>' +
      inner + (below || "") + "</div>"
    );
  }

  const SUPPORT = '<a href="mailto:ai.1991@mil.am">ai.1991@mil.am</a>';

  /* A message in place of a form: an expired link, a finished reset. */
  function authMessage(icon, title, text, action) {
    root.innerHTML = authPage(
      '<div class="form-card auth-card auth-message"><div class="auth-icon" aria-hidden="true">' + icon + "</div>" +
      '<h1 class="auth-title">' + title + "</h1><p>" + text + "</p>" + (action || "") + "</div>");
  }

  /* The new-password fields: show/hide, and a live checklist that keeps the
     button off until the password is long enough and typed the same twice. */
  function newPasswordFields() {
    return (
      '<div class="field"><label for="np-1">' + t("New password") + "</label>" +
      '<div class="pw-wrap"><input id="np-1" name="password" type="password" autocomplete="new-password" minlength="8" required aria-describedby="np-rules" />' +
      '<button type="button" class="pw-toggle" data-pw-toggle aria-controls="np-1 np-2" aria-pressed="false">' + t("Show") + "</button></div></div>" +
      '<div class="field"><label for="np-2">' + t("Type it again") + "</label>" +
      '<input id="np-2" name="confirm" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<ul class="pw-rules" id="np-rules" aria-live="polite">' +
      '<li data-rule="length">' + t("At least 8 characters") + "</li>" +
      '<li data-rule="match">' + t("Both passwords match") + "</li></ul>"
    );
  }

  function bindNewPassword(form) {
    const pw = form.querySelector("#np-1");
    const again = form.querySelector("#np-2");
    const btn = form.querySelector("button[type=submit]");
    const rules = {
      length: () => pw.value.length >= 8,
      match: () => pw.value.length > 0 && pw.value === again.value,
    };
    function update() {
      let ok = true;
      for (const [name, test] of Object.entries(rules)) {
        const pass = test();
        form.querySelector('[data-rule="' + name + '"]').classList.toggle("ok", pass);
        ok = ok && pass;
      }
      btn.disabled = !ok;
    }
    pw.addEventListener("input", update);
    again.addEventListener("input", update);
    form.querySelector("[data-pw-toggle]").addEventListener("click", (e) => {
      const show = pw.type === "password";
      pw.type = again.type = show ? "text" : "password";
      e.currentTarget.textContent = show ? t("Hide") : t("Show");
      e.currentTarget.setAttribute("aria-pressed", String(show));
    });
    update();
  }

  /* An invitation (?welcome=TOKEN) or a reset link (?reset=TOKEN): whose
     account it is, then a new password. An invited student is signed in at
     once; after a reset the owner signs in again. */
  async function renderSetPassword(token, invited) {
    let username;
    try {
      username = (await Auth.welcome(token)).username;
    } catch {
      return authMessage(
        "⌛",
        invited ? t("This invitation link has expired") : t("This link has expired"),
        invited ? t("Ask your instructor for a new one, or write to {0}.", SUPPORT)
                : t("Reset links work for one hour, once. Ask for a new one on the sign-in page."),
        invited ? "" : '<a class="btn btn-primary btn-block" href="account.html">' + t("Sign in") + "</a>");
    }
    root.innerHTML = authPage(
      '<form class="form-card auth-card" data-form="set-password" novalidate>' +
      '<h1 class="auth-title">' + (invited ? t("Welcome to 1991 Academy") : t("Choose a new password")) + "</h1>" +
      '<p class="f-sub">' + (invited ? t("Choose a password to finish setting up your account.")
                                     : t("Choose a new password for your account.")) + "</p>" +
      '<div class="auth-identity"><div class="avatar" aria-hidden="true">' + esc(username[0].toUpperCase()) + "</div>" +
      "<div><span>" + t("Your username") + "</span><strong>" + esc(username) + "</strong></div></div>" +
      /* for password managers: the account this password belongs to */
      '<input class="visually-hidden" type="text" name="username" autocomplete="username" value="' + esc(username) + '" readonly tabindex="-1" aria-hidden="true" />' +
      newPasswordFields() +
      '<button class="btn btn-primary btn-block" type="submit">' + (invited ? t("Start learning") : t("Save new password")) + "</button>" +
      '<p class="form-error" data-error role="alert"></p></form>',
      '<p class="auth-foot">' + t("You can sign in with your username or your email.") +
      '<br /><a href="privacy.html">' + t("Privacy Policy") + "</a></p>");

    const form = root.querySelector("[data-form=set-password]");
    bindNewPassword(form);
    const errEl = form.querySelector("[data-error]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.textContent = "";
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const out = await Auth.resetPassword(token, form.password.value);
        // the token is spent: keep it out of the browser history
        history.replaceState(null, "", location.pathname);
        if (out && out.user) {
          location.href = "index.html";              /* invited: signed in */
          return;
        }
        authMessage("✓", t("Password saved"), t("Sign in with your new password."),
          '<a class="btn btn-primary btn-block" href="account.html">' + t("Sign in") + "</a>");
      } catch (err) {
        errEl.textContent = t(err.message);
        btn.disabled = false;
      }
    });
  }

  /* Where to go after signing in: the page that sent the visitor here
     (?next=/tracks/dl.html), if it is one of this site's. */
  function nextPage() {
    const next = new URLSearchParams(location.search).get("next") || "";
    return /^\/(?!\/)[A-Za-z0-9_\-\/.]*$/.test(next) && !next.includes("..") ? next : "index.html";
  }

  function renderForms() {
    root.innerHTML = authPage(
      '<form class="form-card auth-card" data-form="login">' +
      '<h1 class="auth-title">' + t("Sign in") + "</h1>" +
      '<p class="f-sub">' + t("The online school of 1991 Unit. Sign in with the account your school created for you.") + "</p>" +
      '<div class="field"><label for="li-id">' + t("Username or email") + "</label>" +
      '<input id="li-id" name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required /></div>' +
      '<div class="field"><label for="li-pw">' + t("Password") + "</label>" +
      '<div class="pw-wrap"><input id="li-pw" name="password" type="password" autocomplete="current-password" required />' +
      '<button type="button" class="pw-toggle" data-pw-toggle aria-controls="li-pw" aria-pressed="false">' + t("Show") + "</button></div></div>" +
      '<button class="btn btn-primary btn-block" type="submit">' + t("Sign in") + "</button>" +
      '<p class="form-error" data-error role="alert"></p>' +
      '<button type="button" class="link-btn" data-forgot-open>' + t("Forgot your password?") + "</button>" +
      "</form>" +

      /* forgot-password panel, revealed by the link */
      '<form class="form-card auth-card auth-forgot" data-form="forgot" hidden>' +
      "<h2>" + t("Reset your password") + "</h2>" +
      '<p class="f-sub">' + t("Enter your account email and we'll send a reset link.") + "</p>" +
      '<div class="field"><label for="fg-em">' + t("Email") + "</label>" +
      '<input id="fg-em" name="email" type="email" autocomplete="email" required /></div>' +
      '<div class="dash-actions">' +
      '<button class="btn btn-primary" type="submit">' + t("Send reset link") + "</button>" +
      '<button class="btn" type="button" data-forgot-cancel>' + t("Cancel") + "</button>" +
      "</div><p class=\"form-error\" data-fg-msg role=\"status\"></p></form>",
      '<p class="auth-foot">' + t("No account? Accounts are only for the school's students: ask your instructor, or write to {0}.", SUPPORT) + "</p>");

    const form = root.querySelector("form[data-form=login]");
    const pw = form.querySelector("#li-pw");
    form.querySelector("[data-pw-toggle]").addEventListener("click", (e) => {
      const show = pw.type === "password";
      pw.type = show ? "text" : "password";
      e.currentTarget.textContent = show ? t("Hide") : t("Show");
      e.currentTarget.setAttribute("aria-pressed", String(show));
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = form.querySelector("[data-error]");
      const btn = form.querySelector("button[type=submit]");
      errEl.textContent = "";
      btn.disabled = true;
      const f = new FormData(form);
      try {
        await Auth.login(f.get("identifier").trim(), f.get("password"));
        location.href = nextPage();
      } catch (err) {
        errEl.textContent = t(err.message);
        btn.disabled = false;
      }
    });

    /* forgot-password reveal + submit */
    const forgot = root.querySelector("[data-form=forgot]");
    const fgMsg = forgot.querySelector("[data-fg-msg]");
    root.querySelector("[data-forgot-open]").addEventListener("click", () => {
      forgot.hidden = false;
      forgot.scrollIntoView({ behavior: "smooth", block: "center" });
      forgot.querySelector("input").focus();
    });
    forgot.querySelector("[data-forgot-cancel]").addEventListener("click", () => {
      forgot.hidden = true;
    });
    forgot.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = forgot.querySelector("button[type=submit]");
      btn.disabled = true;
      fgMsg.style.color = "";
      try {
        await Auth.forgotPassword(new FormData(forgot).get("email").trim());
      } catch { /* generic response — ignore errors, show the same message */ }
      fgMsg.style.color = "var(--success)";
      fgMsg.textContent = t("If that email is registered, a reset link is on its way.");
      btn.disabled = false;
    });
  }

  function render() {
    const params = new URLSearchParams(location.search);
    /* the nav's "Sign in" link would lead to this very page */
    const navAccount = document.querySelector("[data-account]");
    if (navAccount) navAccount.hidden = !Auth.current();
    if (params.get("welcome")) return renderSetPassword(params.get("welcome"), true);
    if (params.get("reset")) return renderSetPassword(params.get("reset"), false);
    if (Auth.isOffline()) return renderOffline();
    if (Auth.current()) return renderProfile();
    renderForms();
  }

  render();
  renderStreakPill();
  XP.renderPill();

  /* The profile shows XP/level/streak, so redraw it when progress lands from
     a sync or another tab — but never while a form is being filled in. */
  onStateChanged(() => {
    renderStreakPill();
    XP.renderPill();
    const typing = root.contains(document.activeElement) && document.activeElement.matches("input");
    const params = new URLSearchParams(location.search);
    if (!typing && !params.get("reset") && !params.get("welcome") && Auth.current()) render();
  });
})();
