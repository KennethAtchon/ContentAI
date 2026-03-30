import { adminAuth } from "../../services/firebase/admin";
import { Errors } from "../../utils/errors/app-error";
import type { CustomerService } from "./customer.service";

export async function getProfileWithOAuthFlag(
  customerService: CustomerService,
  userId: string,
  firebaseUid: string | undefined,
) {
  const user = await customerService.getProfile(userId);

  let isOAuthUser = false;
  try {
    if (firebaseUid) {
      const fbUser = await adminAuth.getUser(firebaseUid);
      isOAuthUser = !fbUser.providerData.some(
        (p: { providerId?: string }) => p.providerId === "password",
      );
    }
  } catch {
    // Continue without provider info
  }

  return { profile: user, isOAuthUser };
}

export async function updateCustomerProfile(
  customerService: CustomerService,
  params: {
    userId: string;
    firebaseUid: string;
    currentEmail: string;
    patch: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      timezone?: string;
    };
  },
) {
  const { userId, firebaseUid, currentEmail, patch } = params;
  const { name, email, phone, address, timezone } = patch;

  if (email !== undefined && email !== currentEmail) {
    const fbUser = await adminAuth.getUser(firebaseUid);
    const hasEmailProvider = fbUser.providerData.some(
      (p: { providerId?: string }) => p.providerId === "password",
    );

    if (!hasEmailProvider) {
      throw Errors.badRequest(
        "Cannot change email for OAuth accounts. Update through your OAuth provider.",
        "OAUTH_EMAIL_CHANGE_NOT_ALLOWED",
      );
    }

    try {
      await adminAuth.getUserByEmail(email);
      throw Errors.badRequest("Email already in use", "EMAIL_ALREADY_EXISTS");
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (code === "auth/user-not-found") {
        // Email not taken in Firebase — proceed
      } else {
        throw e;
      }
    }

    await adminAuth.updateUser(firebaseUid, { email });
  }

  const updateData: {
    name?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    timezone?: string;
  } = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone || null;
  if (address !== undefined) updateData.address = address || null;
  if (timezone !== undefined) updateData.timezone = timezone;

  if (Object.keys(updateData).length === 0) {
    throw Errors.badRequest("No fields to update", "NO_FIELDS_PROVIDED");
  }

  try {
    return await customerService.updateProfile(userId, updateData);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "23505") {
      throw Errors.badRequest("Email already exists", "EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }
}
