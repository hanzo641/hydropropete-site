"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;

export function clientAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase n'est pas configuré (variables NEXT_PUBLIC_FIREBASE_*).");
  app ??= getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}
