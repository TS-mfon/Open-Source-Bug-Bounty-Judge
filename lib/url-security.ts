import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ApiError } from "./errors";

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice(7));
  }
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("INVALID_WEBHOOK_URL", "Webhook endpoint is not a valid URL.", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new ApiError(
      "INVALID_WEBHOOK_URL",
      "Webhook endpoint must use HTTPS without embedded credentials.",
      400,
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ApiError(
      "WEBHOOK_PRIVATE_ADDRESS",
      "Webhook endpoint must resolve to a public address.",
      400,
    );
  }

  const literalVersion = isIP(hostname);
  if (literalVersion && isPrivateAddress(hostname)) {
    throw new ApiError(
      "WEBHOOK_PRIVATE_ADDRESS",
      "Webhook endpoint must resolve to a public address.",
      400,
    );
  }

  if (!literalVersion) {
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new ApiError(
        "WEBHOOK_DNS_UNAVAILABLE",
        "Webhook endpoint DNS could not be resolved.",
        422,
        true,
      );
    }
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new ApiError(
        "WEBHOOK_PRIVATE_ADDRESS",
        "Webhook endpoint must resolve only to public addresses.",
        400,
      );
    }
  }

  return url.toString();
}
