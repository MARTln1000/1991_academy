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

  /* ---------- Password reset landing (from the emailed link) ---------- */

  function renderReset(token) {
    root.innerHTML =
      '<div class="auth-grid auth-grid-single">' +
      '<form class="form-card" data-form="reset">' +
      "<h2>" + t("Set a new password") + "</h2>" +
      '<p class="f-sub">' + t("Choose a new password for your account.") + "</p>" +
      '<div class="field"><label for="rs-pw">' + t("New password (min 8 characters)") + "</label>" +
      '<input id="rs-pw" name="password" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<div class="field"><label for="rs-pw2">' + t("Confirm new password") + "</label>" +
      '<input id="rs-pw2" name="confirm" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<button class="btn btn-primary" type="submit">' + t("Save new password") + "</button>" +
      '<p class="form-error" data-error></p></form></div>';

    const form = root.querySelector("[data-form=reset]");
    const errEl = form.querySelector("[data-error]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.style.color = "";
      errEl.textContent = "";
      const f = new FormData(form);
      if (f.get("password") !== f.get("confirm")) {
        errEl.textContent = t("Passwords don't match.");
        return;
      }
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        await Auth.resetPassword(token, f.get("password"));
        // The token is spent; drop it from the URL so it stops living in
        // browser history (and in anything the learner bookmarks or shares).
        history.replaceState(null, "", location.pathname);
        root.innerHTML =
          '<div class="practice-card practice-done"><div class="p-big">✓</div>' +
          "<h2>" + t("Password reset") + "</h2>" +
          "<p>" + t("Sign in with your new password.") + "</p>" +
          '<a class="btn btn-primary" href="account.html">' + t("Sign in") + "</a></div>";
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
      }
    });
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

  /* ---------- Invitation landing (?welcome=TOKEN, from the invitation) ---------- */

  async function renderWelcome(token) {
    let username;
    try {
      username = (await Auth.welcome(token)).username;
    } catch (err) {
      root.innerHTML =
        '<div class="practice-card practice-done"><div class="p-big">⌛</div>' +
        "<h2>" + t("This invitation link has expired") + "</h2>" +
        "<p>" + t("Ask your instructor for a new one, or write to {0}.", '<a href="mailto:ai.1991@mil.am">ai.1991@mil.am</a>') + "</p></div>";
      return;
    }
    root.innerHTML =
      '<div class="auth-grid auth-grid-single">' +
      '<form class="form-card" data-form="welcome">' +
      "<h2>" + t("Welcome to 1991 Academy") + "</h2>" +
      '<p class="f-sub">' + t("Your username is {0}. Choose a password to finish setting up your account.", "<strong>" + esc(username) + "</strong>") + "</p>" +
      '<input type="hidden" name="username" autocomplete="username" value="' + esc(username) + '" />' +
      '<div class="field"><label for="wl-pw">' + t("Password (min 8 characters)") + "</label>" +
      '<input id="wl-pw" name="password" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<div class="field"><label for="wl-pw2">' + t("Confirm new password") + "</label>" +
      '<input id="wl-pw2" name="confirm" type="password" autocomplete="new-password" minlength="8" required /></div>' +
      '<button class="btn btn-primary" type="submit">' + t("Start learning") + "</button>" +
      '<p class="f-sub form-privacy">' + t("What we store and why:") + ' <a href="privacy.html">' + t("Privacy Policy") + "</a></p>" +
      '<p class="form-error" data-error></p></form></div>';

    const form = root.querySelector("[data-form=welcome]");
    const errEl = form.querySelector("[data-error]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.textContent = "";
      const f = new FormData(form);
      if (f.get("password") !== f.get("confirm")) {
        errEl.textContent = t("Passwords don't match.");
        return;
      }
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        await Auth.resetPassword(token, f.get("password"));   /* signs the student in */
        history.replaceState(null, "", location.pathname);
        location.href = "index.html";
      } catch (err) {
        errEl.textContent = t(err.message);
        btn.disabled = false;
      }
    });
  }

  /* ---------- Signed out: sign in / forgot password ----------
     There is no sign-up: the school creates its students' accounts. */

  /* Where to go after signing in: the page that sent the visitor here
     (?next=/tracks/dl.html), if it is one of this site's. */
  function nextPage() {
    const next = new URLSearchParams(location.search).get("next") || "";
    return /^\/(?!\/)[A-Za-z0-9_\-\/.]*$/.test(next) && !next.includes("..") ? next : "index.html";
  }

  function renderForms() {
    root.innerHTML =
      '<h1 style="font-size:1.8rem; margin-bottom:8px">' + t("1991 Academy") + "</h1>" +
      '<p class="section-sub">' + t("The online school of 1991 Unit. Sign in with the account your school created for you.") + "</p>" +
      '<div class="auth-grid auth-grid-single">' +

      '<form class="form-card" data-form="login">' +
      "<h2>" + t("Sign in") + "</h2>" +
      '<div class="field"><label for="li-id">' + t("Username or email") + "</label>" +
      '<input id="li-id" name="identifier" autocomplete="username" required /></div>' +
      '<div class="field"><label for="li-pw">' + t("Password") + "</label>" +
      '<input id="li-pw" name="password" type="password" autocomplete="current-password" required /></div>' +
      '<button class="btn btn-primary" type="submit">' + t("Sign in") + "</button>" +
      '<button type="button" class="link-btn" data-forgot-open>' + t("Forgot your password?") + "</button>" +
      '<p class="form-error" data-error></p>' +
      '<p class="f-sub form-privacy">' + t("No account? Accounts are only for the school's students: ask your instructor, or write to {0}.", '<a href="mailto:ai.1991@mil.am">ai.1991@mil.am</a>') + "</p>" +
      "</form>" +
      "</div>" +

      /* forgot-password panel, revealed by the link */
      '<form class="form-card auth-forgot" data-form="forgot" hidden>' +
      "<h2>" + t("Reset your password") + "</h2>" +
      '<p class="f-sub">' + t("Enter your account email and we'll send a reset link.") + "</p>" +
      '<div class="field"><label for="fg-em">' + t("Email") + "</label>" +
      '<input id="fg-em" name="email" type="email" autocomplete="email" required /></div>' +
      '<div class="dash-actions">' +
      '<button class="btn btn-primary" type="submit">' + t("Send reset link") + "</button>" +
      '<button class="btn" type="button" data-forgot-cancel>' + t("Cancel") + "</button>" +
      "</div><p class=\"form-error\" data-fg-msg></p></form>";

    const form = root.querySelector("form[data-form=login]");
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
    if (params.get("welcome")) return renderWelcome(params.get("welcome"));
    if (params.get("reset")) return renderReset(params.get("reset"));
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
