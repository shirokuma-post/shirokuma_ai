/**
 * URL validation to prevent SSRF attacks.
 * Blocks localhost, private IPs, and non-HTTPS URLs.
 */

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP metadata
];

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS (allow HTTP only in development)
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return false;
    }

    // Block known dangerous hosts
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname)) {
      return false;
    }

    // Block private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(hostname)) {
        return false;
      }
    }

    // Block non-standard ports in production
    if (parsed.port && process.env.NODE_ENV === "production") {
      const port = parseInt(parsed.port);
      if (port !== 443 && port !== 80) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
