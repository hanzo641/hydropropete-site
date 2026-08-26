/* ==========================================================================
   Écho du Royaume — traitement du retour OAuth Strava
   ========================================================================== */

(async () => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const msg = document.getElementById("statusMsg");
  const backLink = document.getElementById("backLink");
  const error = params.get("error");
  const code = params.get("code");

  if (error) {
    msg.textContent = "Connexion refusée. Tu peux réessayer depuis le menu du jeu.";
    backLink.classList.remove("hidden");
    return;
  }
  if (!code) {
    msg.textContent = "Aucun code reçu de Strava.";
    backLink.classList.remove("hidden");
    return;
  }

  try {
    await window.StravaSync.exchangeCode(code);
    msg.textContent = "Connecté ! Retour au jeu…";
    setTimeout(() => { window.location.href = "./index.html"; }, 600);
  } catch (e) {
    msg.textContent = e.message || "Échec de la connexion à Strava.";
    backLink.classList.remove("hidden");
  }
})();
