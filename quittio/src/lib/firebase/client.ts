"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import { firebaseConfig as config, firebaseConfigured } from "./config";

let app: FirebaseApp | undefined;

export function clientAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase n'est pas configuré (variables NEXT_PUBLIC_FIREBASE_*).");
  app ??= getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}
