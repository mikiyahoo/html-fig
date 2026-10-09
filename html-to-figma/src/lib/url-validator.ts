import { z } from "zod";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Check if a hostname string is a private/reserved IP address
function isPrivateIpString(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if ([0, 10, 127].includes(a)) return true;
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
    if (a === 203 && b === 0) return true;
    if (a >= 224) return true; // multicast, reserved and broadcast
  }
  // IPv6 private/loopback
  const ipv6 = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (ipv6 === "::1" || ipv6 === "::" || /^(fc|fd|fe[89ab]|ff)/.test(ipv6) || ipv6.startsWith("2001:db8:")) return true;
  if (ipv6.startsWith("::ffff:")) {
    const mapped = ipv6.slice(7);
    if (mapped.includes(".")) return isPrivateIpString(mapped);
    const parts = mapped.split(":");
    if (parts.length === 2 && parts.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
      const first = parseInt(parts[0], 16); const second = parseInt(parts[1], 16);
      return isPrivateIpString(`${first >> 8}.${first & 255}.${second >> 8}.${second & 255}`);
    }
    return true;
  }
  return false;
}

export const captureSchema = z.object({
  url: z.string()
    .regex(/^https?:\/\/.+/, "URL must start with http:// or https://")
    .refine((url) => {
      try { new URL(url); return true; } catch { return false; }
    }, "Invalid URL format"),
  viewport: z.enum(["desktop", "tablet", "mobile"]),
  fullPageScreenshot: z.boolean().optional().default(false),
  captureAssets: z.boolean().optional().default(true),
  captureSchemaVersion: z.number().optional().default(1),
});

export type CaptureInput = z.infer<typeof captureSchema>;

export const VIEWPORT_CONFIGS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export type Viewport = keyof typeof VIEWPORT_CONFIGS;

export const VIEWPORT_LABELS = {
  desktop: "Desktop (1440x900)",
  tablet: "Tablet (768x1024)",
  mobile: "Mobile (390x844)",
} as const;

const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "169.254.169.254",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "ip6-localhost",
  "ip6-loopback",
  "fe80::1",
  "fe80::",
  "224.0.0.0",
  "240.0.0.0",
  "100.64.0.0",
  "192.0.0.0",
  "192.0.2.0",
  "198.51.100.0",
  "203.0.113.0",
  "240.0.0.0/4",
  "255.255.255.255",
]);

const INTERNAL_SUFFIXES = new Set(["internal", "local", "home", "lan", "office"]);

export function validateUrl(url: string): { valid: boolean; parsedUrl?: URL; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") {
      return { valid: false, error: "Localhost and loopback addresses are not allowed" };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return { valid: false, error: "This destination is blocked for security reasons" };
    }

    if (isPrivateIpString(parsed.hostname)) {
      return { valid: false, error: "Private IP addresses are not allowed" };
    }

    if (INTERNAL_SUFFIXES.has(hostname)) {
      return { valid: false, error: "Internal domain names are not allowed" };
    }

    return { valid: true, parsedUrl: parsed };
  } catch (error) {
    if (error instanceof TypeError) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: "Invalid URL" };
  }
}

export function isCloudMetadataEndpoint(hostname: string): boolean {
  return ["metadata.google.internal", "169.254.169.254"].includes(hostname.toLowerCase());
}

export function isPrivateNetworkDestination(url: URL): boolean {
  return (
    isPrivateIpString(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    isCloudMetadataEndpoint(url.hostname) ||
    url.hostname.endsWith(".internal") ||
    url.hostname.endsWith(".local")
  );
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    return url;
  }
}

/** Resolve hostnames before capture and fail closed if any answer is non-public. */
export async function validatePublicNetworkUrl(url: URL): Promise<boolean> {
  if (isPrivateNetworkDestination(url)) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return !isPrivateIpString(hostname);
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateIpString(address));
  } catch {
    return false;
  }
}
