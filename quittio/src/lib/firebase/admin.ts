import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin non configuré : FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY sont requis.");
  }
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export const adminAuth = () => getAuth(adminApp());

let firestoreConfigured = false;
export const adminDb = () => {
  const db = getFirestore(adminApp());
  if (!firestoreConfigured) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreConfigured = true;
  }
  return db;
};
