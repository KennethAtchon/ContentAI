import { IS_RAILWAY } from "@/utils/config/envUtil";

export interface SecurityIp {
  ip: string;
  source: string;
  isLocalhost: boolean;
}

/**
 * Extract client IP from request headers.
 * On Railway the rightmost X-Forwarded-For segment is used (Railway appends the
 * real client IP). Everywhere else the leftmost segment is used (closest proxy
 * is most trusted).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return IS_RAILWAY
      ? (parts[parts.length - 1] ?? "unknown")
      : (parts[0] ?? "unknown");
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Get security IP info with source annotation and localhost detection.
 */
export function getSecurityIp(request: Request): SecurityIp {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = IS_RAILWAY
      ? (parts[parts.length - 1] ?? "unknown")
      : (parts[0] ?? "unknown");
    return {
      ip,
      source: "x-forwarded-for",
      isLocalhost: ip === "127.0.0.1" || ip === "::1",
    };
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return {
      ip: realIp,
      source: "x-real-ip",
      isLocalhost: realIp === "127.0.0.1" || realIp === "::1",
    };
  }

  return { ip: "unknown", source: "fallback", isLocalhost: false };
}

/**
 * Decode a Firebase JWT bearer token and return the user's Firebase UID.
 * Does NOT verify the token signature — that happens in auth middleware.
 * Used only for rate-limiting key derivation.
 */
export async function extractUserIdFromToken(
  token: string,
): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    return (
      (payload["user_id"] as string | undefined) ??
      (payload["sub"] as string | undefined) ??
      null
    );
  } catch {
    return null;
  }
}
