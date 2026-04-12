import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

const DEFAULT_ALLOWED_HOSTS = [
  /\.cdninstagram\.com$/i,
  /\.fbcdn\.net$/i,
  /\.fna\.fbcdn\.net$/i,
  /^instagram\.com$/i,
  /^www\.instagram\.com$/i,
  /^lookaside\.instagram\.com$/i,
];

export interface RemoteUrlGuardOptions {
  allowedHosts?: RegExp[];
  resolveHost?: (host: string) => Promise<string[]>;
}

function isLoopbackOrPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  if (parts[0] === 0) return true;

  return false;
}

function expandIpv6(ip: string): number[] | null {
  const zoneIndex = ip.indexOf("%");
  const normalizedIp = zoneIndex >= 0 ? ip.slice(0, zoneIndex) : ip;
  const halves = normalizedIp.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(":").filter(Boolean) : [];

  const parsePart = (part: string): number[] | null => {
    if (part.includes(".")) {
      const bytes = part.split(".").map((segment) => Number(segment));
      if (bytes.length !== 4 || bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) {
        return null;
      }
      return [(bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3]];
    }

    const value = Number.parseInt(part, 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) {
      return null;
    }
    return [value];
  };

  const leftGroups: number[] = [];
  for (const part of left) {
    const parsed = parsePart(part);
    if (!parsed) return null;
    leftGroups.push(...parsed);
  }

  const rightGroups: number[] = [];
  for (const part of right) {
    const parsed = parsePart(part);
    if (!parsed) return null;
    rightGroups.push(...parsed);
  }

  const zeroGroupsNeeded = 8 - (leftGroups.length + rightGroups.length);
  if ((halves.length === 1 && zeroGroupsNeeded !== 0) || zeroGroupsNeeded < 0) {
    return null;
  }

  return [...leftGroups, ...new Array(Math.max(0, zeroGroupsNeeded)).fill(0), ...rightGroups];
}

function isLoopbackOrPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip);
  if (!groups || groups.length !== 8) return false;

  const first = groups[0];
  const second = groups[1];

  if (groups.every((group) => group === 0) || groups[7] === 1 && groups.slice(0, 7).every((group) => group === 0)) {
    return true;
  }

  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (first === 0x2001 && second === 0x0db8) return true; // documentation range

  return false;
}

export function isPrivateOrLoopbackIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isLoopbackOrPrivateIpv4(ip);
  if (family === 6) return isLoopbackOrPrivateIpv6(ip);
  return true;
}

export function isAllowedRemoteHost(
  hostname: string,
  allowedHosts: RegExp[] = DEFAULT_ALLOWED_HOSTS,
): boolean {
  const normalized = hostname.trim().toLowerCase();
  return allowedHosts.some((pattern) => pattern.test(normalized));
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true });
  return records.map((record) => record.address);
}

export async function assertSafeRemoteUrl(
  rawUrl: string,
  options: RemoteUrlGuardOptions = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Remote URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Remote URL must use HTTPS");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Remote URL must not include credentials");
  }

  if (!isAllowedRemoteHost(parsed.hostname, options.allowedHosts)) {
    throw new Error(`Remote host is not allowed: ${parsed.hostname}`);
  }

  if (parsed.hostname.toLowerCase() === "localhost") {
    throw new Error("Remote host is not allowed: localhost");
  }

  const resolver = options.resolveHost ?? defaultResolveHost;
  const addresses = await resolver(parsed.hostname);
  if (addresses.length === 0) {
    throw new Error(`Remote host did not resolve: ${parsed.hostname}`);
  }

  for (const address of addresses) {
    if (isPrivateOrLoopbackIp(address)) {
      throw new Error(`Remote host resolved to a private address: ${parsed.hostname}`);
    }
  }

  return parsed;
}

export async function fetchSafeRemoteBuffer(
  rawUrl: string,
  options: RemoteUrlGuardOptions = {},
): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: string }> {
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = await assertSafeRemoteUrl(currentUrl, options);
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "ContentAI-Scraper/1.0" },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Remote fetch redirected without location: ${parsed.toString()}`);
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Remote fetch exceeded redirect limit");
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Remote fetch failed (${response.status}): ${parsed.toString()}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type")?.split(";")[0] ?? null,
      finalUrl: parsed.toString(),
    };
  }

  throw new Error("Remote fetch exceeded redirect limit");
}
