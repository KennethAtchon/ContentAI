import type { IAuthRepository } from "./auth.repository";

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
}

/** Firebase ↔ Postgres user sync (admin API). */
export { FirebaseUserSync } from "./firebase-user-sync";
