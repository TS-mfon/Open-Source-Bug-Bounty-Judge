import { verifyMessage } from "viem";
import { ApiError } from "./errors";
import { sha256 } from "./hash";
import { readApiKeyRecord } from "./genlayer";

export async function requireApiKey(request: Request, scope: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError("API_KEY_REQUIRED", "A bearer API key is required.", 401);
  }
  const apiKey = authorization.slice(7).trim();
  if (!apiKey.startsWith("osj_")) {
    throw new ApiError("INVALID_API_KEY", "The API key is invalid.", 401);
  }
  const record = await readApiKeyRecord(sha256(apiKey));
  if (!record || !record.active) {
    throw new ApiError("INVALID_API_KEY", "The API key is invalid or revoked.", 401);
  }
  if (!record.scopes.includes(scope)) {
    throw new ApiError("MISSING_SCOPE", `The API key requires ${scope}.`, 403);
  }
  return { ...record, key_hash: sha256(apiKey) };
}

export function walletReviewMessage(input: {
  wallet: string;
  expiresAt: number;
  repository: string;
  pullRequestNumber: number;
  headSha: string;
}) {
  return [
    "Open Source Bug Bounty Judge",
    `Wallet: ${input.wallet.toLowerCase()}`,
    `Repository: ${input.repository.toLowerCase()}`,
    `Pull request: ${input.pullRequestNumber}`,
    `Head SHA: ${input.headSha.toLowerCase()}`,
    `Expires at: ${input.expiresAt}`,
  ].join("\n");
}

export async function verifyWalletReview(input: {
  wallet: `0x${string}`;
  signature: `0x${string}`;
  expiresAt: number;
  repository: string;
  pullRequestNumber: number;
  headSha: string;
}) {
  if (input.expiresAt < Math.floor(Date.now() / 1000)) return false;
  if (input.expiresAt > Math.floor(Date.now() / 1000) + 15 * 60) return false;
  return verifyMessage({
    address: input.wallet,
    message: walletReviewMessage(input),
    signature: input.signature,
  });
}
