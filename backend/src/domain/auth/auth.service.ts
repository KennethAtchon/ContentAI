import { adminAuth } from "../../services/firebase/admin";
import { debugLog } from "../../utils/debug/debug";
import type { IAuthRepository } from "./auth.repository";
import { FirebaseUserSync, type SyncResult } from "./firebase-user-sync";

export type EstablishSessionUserInput = {
  firebaseUid: string;
  email: string;
  name: string;
  /** `"admin"` when adminMiddleware-style checks apply */
  level: "user" | "admin";
  hasAdminClaim: boolean;
};

export type EstablishSessionUserResult =
  | {
      ok: true;
      user: { id: string; email: string; role: string };
    }
  | { ok: false; reason: "admin_required" };

export class AuthService {
  constructor(private readonly authRepo: IAuthRepository) {}

  async establishSessionUser(
    input: EstablishSessionUserInput,
  ): Promise<EstablishSessionUserResult> {
    let user = await this.authRepo.upsertUserOnLogin({
      firebaseUid: input.firebaseUid,
      email: input.email,
      name: input.name,
    });

    if (input.level === "admin") {
      const isAdmin = user.role === "admin" || input.hasAdminClaim;
      if (!isAdmin) {
        return { ok: false, reason: "admin_required" };
      }
      if (input.hasAdminClaim && user.role !== "admin") {
        await this.authRepo.setRoleAdminByFirebaseUid(input.firebaseUid);
        user = { ...user, role: "admin" };
      }
    }

    return { ok: true, user };
  }

  /** Bulk: align Firebase Auth with Postgres rows that have `firebase_uid`. */
  async syncAllFirebaseUsers(): Promise<SyncResult[]> {
    try {
      const dbUsers = await this.authRepo.listUsersWithFirebaseUid();
      const results: SyncResult[] = [];

      for (const user of dbUsers) {
        try {
          const firebaseUser = await adminAuth.getUser(user.firebaseUid);

          const needsUpdate =
            firebaseUser.email !== user.email ||
            firebaseUser.displayName !== user.name ||
            firebaseUser.disabled === user.isActive ||
            firebaseUser.customClaims?.role !== user.role;

          if (needsUpdate) {
            const result = await FirebaseUserSync.syncUserUpdate(
              user.firebaseUid,
              {
                email: user.email,
                name: user.name ?? undefined,
                role: user.role,
                isActive: user.isActive,
              },
            );
            results.push(result);
          }
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "auth/user-not-found"
          ) {
            results.push({
              success: false,
              action: "sync",
              firebaseUid: user.firebaseUid,
              error: "Firebase user not found",
            });
          } else {
            results.push({
              success: false,
              action: "sync",
              firebaseUid: user.firebaseUid,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      return results;
    } catch (error) {
      debugLog.error(
        "Error in bulk sync",
        { service: "firebase-sync", action: "bulk_sync" },
        error,
      );
      return [
        {
          success: false,
          action: "bulk_sync",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ];
    }
  }
}
