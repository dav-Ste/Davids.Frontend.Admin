(() => {
  "use strict";

  const el = id => document.getElementById(id);
  const dom = {
    message: el("login-message"),
    submit: el("oidc-login-submit"),
    spinner: el("login-spinner")
  };

  function showMessage(text, kind = "error") {
    if (!dom.message) {
      return;
    }

    if (!text) {
      dom.message.hidden = true;
      dom.message.textContent = "";
      dom.message.classList.remove("success");
      return;
    }

    dom.message.textContent = text;
    dom.message.classList.toggle("success", kind === "success");
    dom.message.hidden = false;
  }

  function setBusy(busy) {
    if (dom.submit) {
      dom.submit.disabled = busy;
    }
    if (dom.spinner) {
      dom.spinner.hidden = !busy;
    }
  }

  async function checkAlreadySignedIn() {
    try {
      const response = await fetch("/auth/session", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });

      if (response.ok) {
        const session = await response.json();
        if (session && session.authenticated && new Set(["admin", "support", "auditor"]).has(String(session.role || "").toLowerCase())) {
          window.location.replace("/admin");
        }
      }
    } catch {
      // Remain on the public SSO landing page when unauthenticated.
    }
  }

  function startOidcLogin() {
    setBusy(true);
    showMessage("");
    window.location.assign("/auth/login?returnUrl=%2Fadmin");
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oidc_failed") {
      showMessage("OpenID Connect authentication could not be completed. Please try signing in again.");
    } else if (params.get("reason") === "expired") {
      showMessage("Your administrator session ended. Please sign in again via OpenID Connect.");
    } else if (params.get("reason") === "signed-out") {
      showMessage("You have signed out of Davids.Frontend.Admin.", "success");
    }

    if (dom.submit) {
      dom.submit.addEventListener("click", startOidcLogin);
    }

    checkAlreadySignedIn();
  }

  init();
})();
