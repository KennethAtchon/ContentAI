import { FirebaseUserSync } from "../auth/firebase-user-sync";
import { Errors } from "../../utils/errors/app-error";
import type { UsersService } from "./users.service";

export async function adminCreateUserWithFirebase(
  usersService: UsersService,
  input: {
    name: string;
    email: string;
    password?: string;
    createInFirebase?: boolean;
    timezone?: string;
  },
) {
  let firebaseUid: string | null = null;

  if (input.createInFirebase) {
    const syncResult = await FirebaseUserSync.syncUserCreate({
      email: input.email,
      name: input.name,
      password: input.password,
      role: "user",
    });
    if (!syncResult.success) {
      throw Errors.internal(
        `Failed to create Firebase user: ${syncResult.error}`,
      );
    }
    firebaseUid = syncResult.firebaseUid || null;
  }

  return usersService.createUser({
    name: input.name,
    email: input.email,
    firebaseUid,
    timezone: input.timezone,
  });
}

export async function adminUpdateUserWithFirebase(
  usersService: UsersService,
  input: {
    id: string;
    phone?: string | null;
    address?: string | null;
    role?: string;
    name?: string;
    email?: string;
    isActive?: boolean;
    timezone?: string;
  },
) {
  const {
    id,
    phone,
    address,
    role,
    name,
    email,
    isActive,
    timezone,
  } = input;

  const existingUser = await usersService.getUserById(id);

  const updatedUser = await usersService.updateUser(id, {
    phone,
    address,
    role,
    name,
    email,
    isActive,
    timezone,
  });

  if (existingUser.firebaseUid) {
    const syncData: Record<string, unknown> = {};
    if (email !== undefined) syncData.email = email;
    if (name !== undefined) syncData.name = name;
    if (role !== undefined) syncData.role = role;
    if (isActive !== undefined) syncData.isActive = isActive;

    if (Object.keys(syncData).length > 0) {
      await FirebaseUserSync.syncUserUpdate(
        existingUser.firebaseUid,
        syncData as {
          email?: string;
          name?: string;
          role?: string;
          isActive?: boolean | null;
        },
      ).catch(() => {});
    }
  }

  return updatedUser;
}

export async function adminDeleteUserWithFirebase(
  usersService: UsersService,
  id: string,
  hardDelete: boolean,
) {
  const existingUser = await usersService.getUserById(id);
  const result = await usersService.deleteUser(id, hardDelete);

  if (existingUser.firebaseUid) {
    await FirebaseUserSync.syncUserDelete(
      existingUser.firebaseUid,
      hardDelete,
    ).catch(() => {});
  }

  return result;
}
