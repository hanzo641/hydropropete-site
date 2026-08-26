// Échange / rafraîchissement de jeton OAuth Strava.
// Le secret client ne doit JAMAIS être exposé au navigateur : cette fonction
// tourne côté serveur (Netlify Functions) et lit STRAVA_CLIENT_ID /
// STRAVA_CLIENT_SECRET depuis les variables d'environnement du site.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Strava n'est pas configuré côté serveur (variables d'environnement manquantes)." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Requête invalide." }) };
  }

  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });

  if (payload.action === "refresh" && typeof payload.refresh_token === "string") {
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", payload.refresh_token);
  } else if (payload.action === "exchange" && typeof payload.code === "string") {
    params.set("grant_type", "authorization_code");
    params.set("code", payload.code);
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants." }) };
  }

  try {
    const stravaRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await stravaRes.json();

    if (!stravaRes.ok) {
      return {
        statusCode: stravaRes.status,
        body: JSON.stringify({ error: data.message || "Échec de l'authentification Strava." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete: data.athlete ? { id: data.athlete.id, firstname: data.athlete.firstname } : undefined,
      }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Impossible de joindre Strava." }) };
  }
};
