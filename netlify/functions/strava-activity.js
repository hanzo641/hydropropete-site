// Proxy vers l'API Strava pour récupérer la dernière course (type "Run" /
// "TrailRun") du compte connecté. Le jeton d'accès transite depuis le
// navigateur (il n'est valable que 6h et lié à l'utilisateur), cette
// fonction ne fait que relayer l'appel pour éviter les soucis de CORS.

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) {
    return { statusCode: 401, body: JSON.stringify({ error: "Non authentifié." }) };
  }

  try {
    const stravaRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=10", {
      headers: { Authorization: auth },
    });

    if (stravaRes.status === 401) {
      return { statusCode: 401, body: JSON.stringify({ error: "Session Strava expirée, reconnecte-toi." }) };
    }

    const activities = await stravaRes.json();
    if (!stravaRes.ok || !Array.isArray(activities)) {
      return {
        statusCode: stravaRes.status || 502,
        body: JSON.stringify({ error: "Impossible de récupérer les activités Strava." }),
      };
    }

    const run = activities.find((a) => a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun");
    if (!run) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activity: null }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity: {
          id: run.id,
          name: run.name,
          distance: run.distance,            // mètres
          moving_time: run.moving_time,       // secondes
          average_speed: run.average_speed,   // m/s
          start_date: run.start_date,
        },
      }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Impossible de joindre Strava." }) };
  }
};
