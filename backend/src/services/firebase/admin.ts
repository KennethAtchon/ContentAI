import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} from "@/utils/config/envUtil";

/**
 * Initialize Firebase Admin SDK if not already initialized
 */
function initializeFirebaseAdmin(): void {
  if (getApps().length > 0) {
    return; // Already initialized
  }

  const projectId = FIREBASE_PROJECT_ID?.trim();
  const clientEmail = FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing required Firebase Admin environment variables: " +
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// Initialize Firebase Admin
initializeFirebaseAdmin();

export const adminAuth = getAuth();
export const adminDb = getFirestore();
