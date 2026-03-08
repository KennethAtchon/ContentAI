import { adminAuth } from "./admin";
import { db } from "@/services/db/db";
import { users } from "@/infrastructure/database/drizzle/schema";
import { isNotNull } from "drizzle-orm";
import { debugLog } from "@/utils/debug";

export interface SyncResult {
  success: boolean;
  action: string;
  firebaseUid?: string;
  error?: string;
}

interface UserUpdateData {
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
}

interface UserCreateData {
  email: string;
  name: string;
  role?: string;
  password?: string;
}

const FIREBASE_ERROR_CODES = {
  USER_NOT_FOUND: "auth/user-not-found",
} as const;

/**
 * Service for syncing database user changes with Firebase Authentication
 */
export class FirebaseUserSync {
  /**
   * Updates Firebase user when database user is updated
   */
  static async syncUserUpdate(
    firebaseUid: string,
    updates: {
      email?: string;
      name?: string;
      role?: string;
      isActive?: boolean;
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
      const updateData: any = {};

      if (updates.email) updateData.email = updates.email;
      if (updates.name) updateData.displayName = updates.name;
      if (updates.isActive !== undefined)
        updateData.disabled = !updates.isActive;

      // Update Firebase user record
      if (Object.keys(updateData).length > 0) {
        await adminAuth.updateUser(firebaseUid, updateData);
      }

      // Update custom claims for role changes
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

  /**
   * Deletes or disables Firebase user when database user is deleted
   */
  static async syncUserDelete(
    firebaseUid: string,
    hardDelete: boolean = false,
  ): Promise<SyncResult> {
    try {
      if (hardDelete) {
        // Completely delete from Firebase
        await adminAuth.deleteUser(firebaseUid);
        return {
          success: true,
          action: "delete",
          firebaseUid,
        };
      } else {
        // Just disable the user
        await adminAuth.updateUser(firebaseUid, { disabled: true });
        return {
          success: true,
          action: "disable",
          firebaseUid,
        };
      }
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

  /**
   * Creates Firebase user when database user is created (rare case)
   */
  static async syncUserCreate(userData: {
    email: string;
    name: string;
    role?: string;
    password?: string;
  }): Promise<SyncResult & { firebaseUid?: string }> {
    try {
      const createData: any = {
        email: userData.email,
        displayName: userData.name,
        disabled: false,
      };

      if (userData.password && userData.password.trim() !== "") {
        createData.password = userData.password;
      }

      const firebaseUser = await adminAuth.createUser(createData);

      // Set custom claims
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

  /**
   * Syncs all database users to Firebase (for bulk operations)
   */
  static async syncAllUsers(): Promise<SyncResult[]> {
    try {
      const dbUsers = await db
        .select()
        .from(users)
        .where(isNotNull(users.firebaseUid));

      const results: SyncResult[] = [];

      for (const user of dbUsers) {
        if (!user.firebaseUid) continue;

        try {
          // Check if Firebase user exists
          const firebaseUser = await adminAuth.getUser(user.firebaseUid);

          // Sync any differences
          const needsUpdate =
            firebaseUser.email !== user.email ||
            firebaseUser.displayName !== user.name ||
            firebaseUser.disabled === user.isActive ||
            firebaseUser.customClaims?.role !== user.role;

          if (needsUpdate) {
            const result = await this.syncUserUpdate(user.firebaseUid, {
              email: user.email,
              name: user.name,
              role: user.role,
              isActive: user.isActive,
            });
            results.push(result);
          }
        } catch (error) {
          // Firebase user doesn't exist - this is expected for some cases
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

/**
 * Build Firebase update data from user updates
 */
function _buildFirebaseUpdateData(
  updates: UserUpdateData,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (updates.email) updateData.email = updates.email;
  if (updates.name) updateData.displayName = updates.name;
  if (updates.isActive !== undefined) updateData.disabled = !updates.isActive;

  return updateData;
}

/**
 * Build Firebase create data from user data
 */
function _buildFirebaseCreateData(
  userData: UserCreateData,
): Record<string, unknown> {
  const createData: Record<string, unknown> = {
    email: userData.email,
    displayName: userData.name,
    disabled: false,
  };

  if (userData.password) {
    createData.password = userData.password;
  }

  return createData;
}

/**
 * Type guard for Firebase user not found errors
 */
function _isFirebaseUserNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === FIREBASE_ERROR_CODES.USER_NOT_FOUND
  );
}
