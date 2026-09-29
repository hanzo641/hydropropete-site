/**
 * delete-account : suppression définitive du compte (droit à l'effacement). La suppression
 * de l'utilisateur Auth supprime en cascade profil, réglages, courses, traces, déploiements,
 * trophées et statistiques ; les événements du fil sont anonymisés (actor_id → null).
 * Les territoires conquis restent sur la carte (ils appartiennent à la faction, pas au joueur).
 */
import { handler, HttpError, json, readJson, requireUser, serviceClient } from '../_shared/http.ts';

Deno.serve(
  handler(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    const body = await readJson<{ confirm?: boolean }>(req, 1000);
    if (body.confirm !== true) throw new HttpError(400, 'confirmation_required');
    const { error: e1 } = await db.from('events').update({ actor_id: null, actor_name: null }).eq('actor_id', user.id);
    if (e1) throw e1;
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  }),
);
