(function () {
  const config = window.DEVIS_RELANCE_CONFIG || {};
  const hasSupabase = Boolean(
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("REMPLACE_") &&
    !config.supabaseAnonKey.includes("REMPLACE_")
  );
  const sessionKey = "devis_relance_session";
  const adminPreviewKey = "devis_relance_admin_preview";

  const planAccess = {
    gratuit: { label: "Gratuit", quoteLimit: 3, followups: 5, sms: false, human: false },
    decouverte: { label: "Découverte", quoteLimit: 20, followups: 60, sms: false, human: false },
    pro: { label: "Pro Humain", quoteLimit: Infinity, followups: Infinity, sms: true, human: true },
    premium: { label: "Premium", quoteLimit: Infinity, followups: Infinity, sms: true, human: true }
  };

  function safeText(value) {
    return String(value || "").replace(/[<>]/g, "");
  }

  function redirectUrl() {
    return config.authRedirectUrl && !config.authRedirectUrl.includes("REMPLACE_")
      ? config.authRedirectUrl
      : new URL("dashboard.html", window.location.href).href;
  }

  function authUrl(path) {
    return config.supabaseUrl.replace(/\/$/, "") + "/auth/v1" + path;
  }

  function restUrl(path) {
    return config.supabaseUrl.replace(/\/$/, "") + "/rest/v1" + path;
  }

  function headers(token) {
    const base = {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json"
    };
    if (token) base.Authorization = "Bearer " + token;
    return base;
  }

  function showMessage(container, text, isError) {
    if (!container) return;
    container.textContent = text;
    container.style.display = "block";
    container.classList.toggle("error-message", Boolean(isError));
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map(function (byte) { return byte.toString(16).padStart(2, "0"); })
      .join("");
  }

  function showConfigAlerts() {
    document.querySelectorAll("#auth-config-alert, [data-dashboard-message]").forEach(function (item) {
      item.hidden = false;
      item.textContent = "Connexion sécurisée non configurée : ajoutez les clés publiques Supabase dans app-config.js. Aucun compte n’est créé tant que ce n’est pas configuré.";
    });
    document.querySelectorAll("[data-signup-form] button, [data-login-form] button, [data-quote-form] button").forEach(function (button) {
      button.disabled = true;
    });
  }

  async function request(path, options) {
    const response = await fetch(path, options);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(payload && payload.msg ? payload.msg : "Action impossible pour le moment.");
    }
    return payload;
  }

  function saveSession(session) {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function getSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
      if (!session || !session.access_token) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function getAdminPreview() {
    try {
      const session = JSON.parse(sessionStorage.getItem(adminPreviewKey) || "null");
      if (!session || session.role !== "admin" || session.expires_at < Date.now()) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(adminPreviewKey);
  }

  function captureSessionFromUrl() {
    if (!window.location.hash.includes("access_token")) return getSession();
    const params = new URLSearchParams(window.location.hash.slice(1));
    const session = {
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      token_type: params.get("token_type") || "bearer",
      expires_at: Date.now() + (Number(params.get("expires_in") || 3600) * 1000)
    };
    if (session.access_token) saveSession(session);
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return getSession();
  }

  async function sendMagicLink(form, createUser) {
    const message = form.querySelector("[data-auth-message]");
    const formData = new FormData(form);
    const email = safeText(formData.get("email")).trim().toLowerCase();
    if (!email) return;

    const metadata = createUser
      ? {
          full_name: safeText(formData.get("name")),
          company: safeText(formData.get("company")),
          phone: safeText(formData.get("phone")),
          requested_plan: safeText(formData.get("plan")) || "gratuit"
        }
      : undefined;

    await request(authUrl("/otp") + "?redirect_to=" + encodeURIComponent(redirectUrl()), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: email,
        create_user: createUser,
        data: metadata
      })
    });

    showMessage(message, "Lien sécurisé envoyé. Ouvrez l’email pour accéder à votre dashboard.", false);
    form.reset();
  }

  function demoQuotes() {
    return [
      { id: "demo-1", client_name: "Martin", project: "Climatisation maison", amount: 4800, status: "en_cours", channel: "sms", next_followup: "2026-05-20" },
      { id: "demo-2", client_name: "Bernard", project: "Rénovation salle de bain", amount: 7200, status: "valide", channel: "humain", next_followup: "2026-05-18" },
      { id: "demo-3", client_name: "Lopez", project: "Peinture appartement", amount: 2100, status: "en_cours", channel: "email", next_followup: "2026-05-17" },
      { id: "demo-4", client_name: "Durand", project: "Remplacement pompe à chaleur", amount: 6800, status: "en_cours", channel: "email", next_followup: "2026-05-24" }
    ];
  }

  async function getUser(session) {
    return request(authUrl("/user"), {
      method: "GET",
      headers: headers(session.access_token)
    });
  }

  async function getProfile(session, user) {
    const profiles = await request(restUrl("/profiles?select=*&id=eq." + encodeURIComponent(user.id) + "&limit=1"), {
      method: "GET",
      headers: headers(session.access_token)
    });
    return profiles[0] || {
      id: user.id,
      plan: "gratuit",
      subscription_status: "free"
    };
  }

  async function getQuotes(session) {
    return request(restUrl("/quotes?select=*&order=created_at.desc"), {
      method: "GET",
      headers: headers(session.access_token)
    });
  }

  async function createQuote(session, payload) {
    return request(restUrl("/quotes"), {
      method: "POST",
      headers: Object.assign(headers(session.access_token), { Prefer: "return=representation" }),
      body: JSON.stringify(payload)
    });
  }

  async function updateQuote(session, id, patch) {
    return request(restUrl("/quotes?id=eq." + encodeURIComponent(id)), {
      method: "PATCH",
      headers: Object.assign(headers(session.access_token), { Prefer: "return=representation" }),
      body: JSON.stringify(patch)
    });
  }

  function quoteCard(quote, actions) {
    const amount = Number(quote.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    const next = quote.next_followup ? new Date(quote.next_followup).toLocaleDateString("fr-FR") : "Non planifiée";
    return [
      '<article class="quote-card">',
      "<div>",
      "<strong>" + safeText(quote.project) + "</strong>",
      "<span>" + safeText(quote.client_name) + " · " + amount + " · " + safeText(quote.channel || "email") + "</span>",
      "</div>",
      '<div class="quote-meta"><span>' + next + "</span><em>" + safeText(quote.status || "en cours") + "</em></div>",
      actions ? '<div class="quote-actions"><button type="button" data-quote-valid="' + quote.id + '">Valider</button><button type="button" data-quote-lost="' + quote.id + '">Perdu</button></div>' : "",
      "</article>"
    ].join("");
  }

  function renderQuotes(quotes, access) {
    const active = quotes.filter(function (item) { return item.status === "en_cours"; });
    const valid = quotes.filter(function (item) { return item.status === "valide"; });
    const upcoming = active
      .filter(function (item) { return item.next_followup; })
      .sort(function (a, b) { return String(a.next_followup).localeCompare(String(b.next_followup)); });
    const late = active.filter(function (item) {
      return item.next_followup && new Date(item.next_followup) < new Date();
    });

    document.querySelector("[data-metric-active]").textContent = active.length;
    document.querySelector("[data-metric-valid]").textContent = valid.length;
    document.querySelector("[data-metric-next]").textContent = upcoming.length;
    document.querySelector("[data-metric-late]").textContent = late.length;

    document.querySelector("[data-quotes-list]").innerHTML = active.length ? active.map(function (quote) { return quoteCard(quote, true); }).join("") : '<div class="empty-state">Aucun devis en cours.</div>';
    document.querySelector("[data-upcoming-list]").innerHTML = upcoming.length ? upcoming.map(function (quote) { return quoteCard(quote, true); }).join("") : '<div class="empty-state">Aucune relance prochaine.</div>';
    document.querySelector("[data-valid-list]").innerHTML = valid.length ? valid.map(function (quote) { return quoteCard(quote, false); }).join("") : '<div class="empty-state">Aucun devis validé pour le moment.</div>';

    document.querySelector("[data-plan-limits]").textContent =
      "Votre plan autorise " + (access.quoteLimit === Infinity ? "un nombre illimité de devis actifs" : access.quoteLimit + " devis actifs") + ".";
  }

  async function initDashboard() {
    if (!document.body.matches("[data-dashboard]")) return;
    const adminPreview = getAdminPreview();
    if (adminPreview) {
      const access = planAccess.premium;
      const quotes = demoQuotes();
      document.querySelector("[data-plan-name]").textContent = "Admin aperçu";
      document.querySelector("[data-plan-note]").textContent = "Mode administrateur de test. Données de démonstration uniquement.";
      document.querySelector("[data-access-quotes]").textContent = "Illimité";
      document.querySelector("[data-access-followups]").textContent = "Illimité";
      document.querySelector("[data-access-sms]").textContent = "Oui";
      document.querySelector("[data-access-human]").textContent = "Oui";
      renderQuotes(quotes, access);
      document.querySelector("[data-quote-form]").addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Mode admin aperçu : branchez Supabase pour enregistrer de vrais devis.");
      });
      return;
    }

    if (!hasSupabase) {
      showConfigAlerts();
      return;
    }

    const session = captureSessionFromUrl();
    const message = document.querySelector("[data-dashboard-message]");
    if (!session) {
      message.hidden = false;
      message.textContent = "Connectez-vous pour accéder au dashboard.";
      window.setTimeout(function () { window.location.href = "compte.html#connexion"; }, 1200);
      return;
    }

    try {
      const user = await getUser(session);
      const profile = await getProfile(session, user);
      const plan = profile.plan || "gratuit";
      const access = planAccess[plan] || planAccess.gratuit;
      document.querySelector("[data-plan-name]").textContent = access.label;
      document.querySelector("[data-plan-note]").textContent = profile.subscription_status === "active" ? "Abonnement actif." : "Compte gratuit ou abonnement en attente de confirmation Stripe.";
      document.querySelector("[data-access-quotes]").textContent = access.quoteLimit === Infinity ? "Illimité" : access.quoteLimit;
      document.querySelector("[data-access-followups]").textContent = access.followups === Infinity ? "Illimité" : access.followups;
      document.querySelector("[data-access-sms]").textContent = access.sms ? "Oui" : "Non";
      document.querySelector("[data-access-human]").textContent = access.human ? "Oui" : "Non";

      let quotes = await getQuotes(session);
      renderQuotes(quotes, access);

      document.querySelector("[data-quote-form]").addEventListener("submit", async function (event) {
        event.preventDefault();
        const activeCount = quotes.filter(function (item) { return item.status === "en_cours"; }).length;
        if (access.quoteLimit !== Infinity && activeCount >= access.quoteLimit) {
          alert("Limite atteinte pour votre abonnement. Passez à l’offre supérieure pour ajouter plus de devis actifs.");
          return;
        }
        const data = new FormData(event.currentTarget);
        const channel = safeText(data.get("channel"));
        if ((channel === "sms" && !access.sms) || (channel === "humain" && !access.human)) {
          alert("Cette fonctionnalité dépend de votre abonnement.");
          return;
        }
        await createQuote(session, {
          user_id: user.id,
          client_name: safeText(data.get("client_name")),
          project: safeText(data.get("project")),
          amount: Number(data.get("amount") || 0),
          next_followup: data.get("next_followup") || null,
          channel: channel,
          status: "en_cours"
        });
        event.currentTarget.reset();
        quotes = await getQuotes(session);
        renderQuotes(quotes, access);
      });

      document.body.addEventListener("click", async function (event) {
        const validId = event.target.getAttribute("data-quote-valid");
        const lostId = event.target.getAttribute("data-quote-lost");
        if (!validId && !lostId) return;
        await updateQuote(session, validId || lostId, { status: validId ? "valide" : "perdu" });
        quotes = await getQuotes(session);
        renderQuotes(quotes, access);
      });
    } catch (error) {
      message.hidden = false;
      message.textContent = "Session expirée ou configuration incomplète. Reconnectez-vous.";
      clearSession();
    }
  }

  function initAuthForms() {
    if (!hasSupabase) {
      showConfigAlerts();
      return;
    }

    const signup = document.querySelector("[data-signup-form]");
    if (signup) {
      signup.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          await sendMagicLink(signup, true);
        } catch (error) {
          showMessage(signup.querySelector("[data-auth-message]"), error.message, true);
        }
      });
    }

    const login = document.querySelector("[data-login-form]");
    if (login) {
      login.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          await sendMagicLink(login, false);
        } catch (error) {
          showMessage(login.querySelector("[data-auth-message]"), error.message, true);
        }
      });
    }

    document.querySelectorAll("[data-logout]").forEach(function (button) {
      button.addEventListener("click", function () {
        clearSession();
        window.location.href = "compte.html#connexion";
      });
    });
  }

  function initAdminLogin() {
    const form = document.querySelector("[data-admin-login]");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const message = form.querySelector("[data-auth-message]");
      if (!config.adminPreviewEnabled) {
        showMessage(message, "Accès admin désactivé.", true);
        return;
      }
      const data = new FormData(form);
      const username = String(data.get("username") || "").trim();
      const password = String(data.get("password") || "");
      const usernameHash = await sha256(username);
      const hash = await sha256(password);
      if (usernameHash !== config.adminPreviewUserHash || hash !== config.adminPreviewPasswordHash) {
        showMessage(message, "Identifiant ou mot de passe incorrect.", true);
        return;
      }
      sessionStorage.setItem(adminPreviewKey, JSON.stringify({
        role: "admin",
        expires_at: Date.now() + 2 * 60 * 60 * 1000
      }));
      showMessage(message, "Connexion admin validée. Redirection...", false);
      window.setTimeout(function () {
        window.location.href = "dashboard.html";
      }, 500);
    });
  }

  document.querySelectorAll("[data-tab-target]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll("[data-tab-target]").forEach(function (item) { item.classList.remove("active"); });
      document.querySelectorAll("[data-tab-panel]").forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");
      document.querySelector('[data-tab-panel="' + button.dataset.tabTarget + '"]').classList.add("active");
    });
  });

  initAuthForms();
  initAdminLogin();
  initDashboard();
})();
