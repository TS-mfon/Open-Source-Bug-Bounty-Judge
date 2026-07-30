import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { ApiError } from "./errors";
import { getServerConfig, isContractConfigured, publicConfig } from "./config";
import type { CampaignInput, ContributionInput, StoredReview } from "./types";

function ensureContract() {
  if (!isContractConfigured) {
    throw new ApiError(
      "CONTRACT_NOT_CONFIGURED",
      "The GenLayer contract address is not configured.",
      503,
      true,
    );
  }
}

function reader() {
  ensureContract();
  return createClient({ chain: studionet });
}

function writer() {
  ensureContract();
  const key = getServerConfig().privateKey;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new ApiError(
      "SIGNER_NOT_CONFIGURED",
      "The platform GenLayer signer is not configured.",
      503,
      false,
    );
  }
  return createClient({ chain: studionet, account: createAccount(key as `0x${string}`) });
}

export type ApiKeyRecord = {
  organization_id: string;
  scopes: string[];
  active: boolean;
};

export async function readApiKeyRecord(hash: string): Promise<ApiKeyRecord | undefined> {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_api_key",
    args: [hash],
  });
  if (typeof value !== "string" || !value) return undefined;
  return JSON.parse(value) as ApiKeyRecord;
}

export async function registerOrganizationAndKey(input: {
  organizationId: string;
  organizationName: string;
  ownerWallet: string;
  keyHash: string;
  scopes: string[];
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "register_organization_and_api_key",
    args: [
      input.organizationId,
      input.organizationName,
      input.ownerWallet,
      input.keyHash,
      JSON.stringify(input.scopes),
    ],
    value: 0n,
  });
}

export async function createCampaign(
  organizationId: string,
  campaign: CampaignInput,
  rubricVersion: string,
  keyHash: string,
  idempotencyKey: string,
) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "create_campaign",
    args: [
      campaign.id,
      organizationId,
      campaign.externalId,
      campaign.name,
      campaign.budgetUsdcMicros,
      campaign.qualityThreshold,
      campaign.startsAt,
      campaign.endsAt,
      campaign.evidenceCutoff,
      rubricVersion,
      JSON.stringify(campaign.rubric),
      keyHash,
      idempotencyKey,
    ],
    value: 0n,
  });
}

export async function addContributions(
  campaignId: string,
  organizationId: string,
  contributions: ContributionInput[],
  keyHash: string,
  idempotencyKey: string,
) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "add_contributions",
    args: [
      campaignId,
      organizationId,
      JSON.stringify(contributions),
      keyHash,
      idempotencyKey,
    ],
    value: 0n,
  });
}

export async function submitCampaignReview(input: {
  reviewId: string;
  reviewKey: string;
  campaignId: string;
  organizationId: string;
  keyHash: string;
  idempotencyKey: string;
  appealContext: string;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "request_campaign_review",
    args: [
      input.reviewId,
      input.reviewKey,
      input.campaignId,
      input.organizationId,
      input.keyHash,
      input.idempotencyKey,
      input.appealContext,
    ],
    value: 0n,
  });
}

export async function submitSingleReview(input: {
  reviewId: string;
  reviewKey: string;
  wallet: string;
  contribution: ContributionInput;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "request_single_review",
    args: [
      input.reviewId,
      input.reviewKey,
      input.wallet,
      JSON.stringify(input.contribution),
    ],
    value: 0n,
  });
}

export async function submitCampaignAppeal(input: {
  reviewId: string;
  reviewKey: string;
  originalReviewId: string;
  organizationId: string;
  keyHash: string;
  idempotencyKey: string;
  appealContext: string;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "request_campaign_appeal",
    args: [
      input.reviewId,
      input.reviewKey,
      input.originalReviewId,
      input.organizationId,
      input.keyHash,
      input.idempotencyKey,
      input.appealContext,
    ],
    value: 0n,
  });
}

export async function setWebhookEndpoint(
  organizationId: string,
  endpointUrl: string,
  keyHash: string,
) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "set_webhook_endpoint",
    args: [organizationId, endpointUrl, keyHash],
    value: 0n,
  });
}

export async function markWebhookDelivered(deliveryKey: string) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "mark_webhook_delivered",
    args: [deliveryKey],
    value: 0n,
  });
}

export async function readReviewCount() {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_review_count",
    args: [],
  });
  return Number(value);
}

export async function readReviewIdAt(index: number) {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_review_id_at",
    args: [index],
  });
  return typeof value === "string" ? value : "";
}

export async function readWebhookEndpoint(organizationId: string) {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_webhook_endpoint",
    args: [organizationId],
  });
  return typeof value === "string" ? value : "";
}

export async function isWebhookDelivered(deliveryKey: string) {
  return Boolean(
    await reader().readContract({
      address: publicConfig.contractAddress,
      functionName: "is_webhook_delivered",
      args: [deliveryKey],
    }),
  );
}

export async function readCampaign(id: string) {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_campaign",
    args: [id],
  });
  return typeof value === "string" && value ? JSON.parse(value) : undefined;
}

export async function readCampaignContributions(id: string): Promise<ContributionInput[]> {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_campaign_contributions",
    args: [id],
  });
  return typeof value === "string" && value ? JSON.parse(value) : [];
}

export async function readReview(id: string): Promise<StoredReview | undefined> {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_review",
    args: [id],
  });
  return typeof value === "string" && value ? (JSON.parse(value) as StoredReview) : undefined;
}

export async function readReviewByKey(key: string): Promise<string> {
  const value = await reader().readContract({
    address: publicConfig.contractAddress,
    functionName: "get_review_id_by_key",
    args: [key],
  });
  return typeof value === "string" ? value : "";
}

export async function readTransaction(hash: `0x${string}`) {
  const transaction = await reader().getTransaction({
    hash: hash as `0x${string}` & { length: 66 },
  });
  return {
    status: transaction.statusName ?? TransactionStatus.PENDING,
    executionResult: transaction.txExecutionResultName ?? ExecutionResult.NOT_VOTED,
  };
}
