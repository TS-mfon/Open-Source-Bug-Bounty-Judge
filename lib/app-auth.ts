import { ApiError } from "./errors";
import { verifyWalletAction } from "./auth";
import { walletActionEnvelopeSchema } from "./schemas";

export async function requireWalletAction(body: unknown, expectedAction: string) {
  const envelope = walletActionEnvelopeSchema.parse(body);
  if (envelope.action !== expectedAction) {
    throw new ApiError("INVALID_ACTION", "The signed wallet action is invalid.", 422);
  }
  const valid = await verifyWalletAction({
    wallet: envelope.wallet as `0x${string}`,
    signature: envelope.signature as `0x${string}`,
    action: envelope.action,
    payloadHash: envelope.payloadHash,
    payload: envelope.payload,
    nonce: envelope.nonce,
    expiresAt: envelope.expiresAt,
  });
  if (!valid) {
    throw new ApiError("INVALID_WALLET_SIGNATURE", "Wallet action signature is invalid.", 401);
  }
  return envelope;
}
