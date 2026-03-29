import { adminAuth } from "../../services/firebase/admin";
import { debugLog } from "../../utils/debug/debug";

export interface SyncResult {
  success: boolean;
  action: string;
  firebaseUid?: string;
  error?: string;
}

/**
 * Syncs Postgres user lifecycle events to Firebase Authentication (admin API).
 * Domain-owned orchestration; Firebase SDK stays under `services/firebase/`.
 */
export class FirebaseUserSync {
  static async syncUserUpdate(
    firebaseUid: string,
    updates: {
      email?: string;
      name?: string;
      role?: string;
      isActive?: boolean | null;
    },
  ): Promise<SyncResult> {
    if (!firebaseUid || firebaseUid.trim() === "") {
      return {
        success: false,
        action: "update",
        firebaseUid: firebaseUid || "",
        error: "Invalid Firebase UID",
      };
    }

    try {
      const updateData: Record<string, unknown> = {};

      if (updates.email) updateData.email = updates.email;
      if (updates.name) updateData.displayName = updates.name;
      if (updates.isActive !== undefined) {
        updateData.disabled =
          updates.isActive === null ? true : !updates.isActive;
      }

      if (Object.keys(updateData).length > 0) {
        await adminAuth.updateUser(firebaseUid, updateData);
      }

      if (updates.role) {
        await adminAuth.setCustomUserClaims(firebaseUid, {
          role: updates.role,
        });
      }

      return {
        success: true,
        action: "update",
        firebaseUid,
      };
    } catch (error) {
      debugLog.error(
        "Error syncing user update to Firebase",
        { service: "firebase-sync", action: "update", firebaseUid },
        error,
      );
      return {
        success: false,
        action: "update",
        firebaseUid,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async syncUserDelete(
    firebaseUid: string,
    hardDelete: boolean = false,
  ): Promise<SyncResult> {
    try {
      if (hardDelete) {
        await adminAuth.deleteUser(firebaseUid);
        return {
          success: true,
          action: "delete",
          firebaseUid,
        };
      }
      await adminAuth.updateUser(firebaseUid, { disabled: true });
      return {
        success: true,
        action: "disable",
        firebaseUid,
      };
    } catch (error) {
      debugLog.error(
        "Error syncing user deletion to Firebase",
        {
          service: "firebase-sync",
          action: hardDelete ? "delete" : "disable",
          firebaseUid,
        },
        error,
      );
      return {
        success: false,
        action: hardDelete ? "delete" : "disable",
        firebaseUid,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async syncUserCreate(userData: {
    email: string;
    name: string;
    role?: string;
    password?: string;
  }): Promise<SyncResult & { firebaseUid?: string }> {
    try {
      const createData: Record<string, unknown> = {
        email: userData.email,
        displayName: userData.name,
        disabled: false,
      };

      if (userData.password && userData.password.trim() !== "") {
        createData.password = userData.password;
      }

      const firebaseUser = await adminAuth.createUser(createData);

      if (userData.role) {
        await adminAuth.setCustomUserClaims(firebaseUser.uid, {
          role: userData.role,
        });
      }

      return {
        success: true,
        action: "create",
        firebaseUid: firebaseUser.uid,
      };
    } catch (error) {
      debugLog.error(
        "Error syncing user creation to Firebase",
        { service: "firebase-sync", action: "create" },
        error,
      );
      return {
        success: false,
        action: "create",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
