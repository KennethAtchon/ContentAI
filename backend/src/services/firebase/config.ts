/**
 * Firebase Client Configuration
 *
 * Exports the Firebase client SDK config object built from environment variables.
 * Used wherever a Firebase client app instance is needed server-side
 * (e.g. verifying ID tokens via REST, calling Firebase Cloud Functions).
 *
 * For Firebase Admin operations (Firestore, Auth management) use `admin.ts` instead.
 */

import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
} from "@/utils/config/envUtil";

export const firebaseClientConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
} as const;

export type FirebaseClientConfig = typeof firebaseClientConfig;
