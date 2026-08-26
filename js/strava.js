/* ==========================================================================
   Écho du Royaume — connexion Strava (OAuth) et récupération de la dernière
   course. L'échange de code / le rafraîchissement de jeton passent par des
   fonctions serveur (Netlify Functions) pour ne jamais exposer le secret
   Strava côté client. Voir netlify/functions/strava-*.js et le README.
   ========================================================================== */

(() => {
  "use strict";

  // Client ID Strava (public, sans risque à exposer). À remplacer par le
  // vôtre après création de l'application sur https://www.strava.com/settings/api
  const CLIENT_ID = "REMPLACER_PAR_VOTRE_STRAVA_CLIENT_ID";
  const SCOPE = "activity:read_all";
  const STORAGE_KEY = "echoRoyaumeStravaAuth_v1";
  const FUNCTIONS_BASE = "/.netlify/functions";

  function redirectUri() {
    return `${window.location.origin}/game/strava-callback.html`;
  }

  function loadAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveAuth(auth) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(auth)); } catch (e) { /* stockage indisponible */ }
  }

  function clearAuth() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* stockage indisponible */ }
  }

  function isConnected() {
    const a = loadAuth();
    return !!(a && a.refresh_token);
  }

  function currentAthlete() {
    const a = loadAuth();
    return (a && a.athlete) || null;
  }

  function connect() {
    const url = new URL("https://www.strava.com/oauth/authorize");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", SCOPE);
    window.location.href = url.toString();
  }

  function disconnect() {
    clearAuth();
  }

  async function exchangeCode(code) {
    const res = await fetch(`${FUNCTIONS_BASE}/strava-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exchange", code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Échec de la connexion à Strava.");
    saveAuth(data);
    return data;
  }

  async function ensureFreshToken() {
    let auth = loadAuth();
    if (!auth) {
      const err = new Error("Connecte d'abord ton compte Strava.");
      err.code = "NOT_CONNECTED";
      throw err;
    }
    const now = Math.floor(Date.now() / 1000);
    if (auth.expires_at && auth.expires_at - now > 60) return auth.access_token;

    const res = await fetch(`${FUNCTIONS_BASE}/strava-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", refresh_token: auth.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      clearAuth();
      throw new Error(data.error || "Session Strava expirée, reconnecte-toi.");
    }
    auth = Object.assign({}, auth, data);
    saveAuth(auth);
    return auth.access_token;
  }

  async function fetchLatestRun() {
    const token = await ensureFreshToken();
    const res = await fetch(`${FUNCTIONS_BASE}/strava-activity`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Impossible de récupérer la course.");
    return data.activity; // null si aucune course récente
  }

  window.StravaSync = {
    isConnected,
    currentAthlete,
    connect,
    disconnect,
    exchangeCode,
    fetchLatestRun,
  };
})();
