import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { ApiError } from "./errors";
import {
  getServerConfig,
  isContractConfigured,
  isRegistryConfigured,
  publicConfig,
} from "./config";
import type {
  CampaignInput,
  CampaignRecord,
  ContributionInput,
  Organization,
  StoredReview,
  WalletProfile,
} from "./types";

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
  campaign_id: string;
  scopes: string[];
  active: boolean;
  usage_count?: number;
  max_requests?: number;
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

function ensureRegistry() {
  if (!isRegistryConfigured) {
    throw new ApiError(
      "REGISTRY_NOT_CONFIGURED",
      "The GenLayer organization registry address is not configured.",
      503,
      true,
    );
  }
}

function registryReader() {
  ensureRegistry();
  return createClient({ chain: studionet });
}

function registryWriter() {
  ensureRegistry();
  const key = getServerConfig().privateKey;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new ApiError("SIGNER_NOT_CONFIGURED", "The platform signer is not configured.", 503);
  }
  return createClient({ chain: studionet, account: createAccount(key as `0x${string}`) });
}

export async function registerWalletProfile(input: {
  wallet: string;
  defaultWorkspace: "individual" | "organization";
  nonce: number;
}) {
  return registryWriter().writeContract({
    address: publicConfig.registryAddress,
    functionName: "register_profile",
    args: [input.wallet, input.defaultWorkspace, input.nonce],
    value: 0n,
  });
}

export async function readWalletProfile(wallet: string): Promise<WalletProfile | undefined> {
  const value = await registryReader().readContract({
    address: publicConfig.registryAddress,
    functionName: "get_profile",
    args: [wallet],
  });
  return typeof value === "string" && value ? (JSON.parse(value) as WalletProfile) : undefined;
}

export async function readRegistryNonce(wallet: string) {
  return Number(
    await registryReader().readContract({
      address: publicConfig.registryAddress,
      functionName: "get_wallet_nonce",
      args: [wallet],
    }),
  );
}

export async function createOrganization(input: {
  organizationId: string;
  name: string;
  creatorWallet: string;
  nonce: number;
}) {
  return registryWriter().writeContract({
    address: publicConfig.registryAddress,
    functionName: "create_organization",
    args: [input.organizationId, input.name, input.creatorWallet, input.nonce],
    value: 0n,
  });
}

export async function addOrganizationMember(input: {
  organizationId: string;
  actorWallet: string;
  memberWallet: string;
  role: "admin" | "member";
  nonce: number;
}) {
  return registryWriter().writeContract({
    address: publicConfig.registryAddress,
    functionName: "add_member",
    args: [
      input.organizationId,
      input.actorWallet,
      input.memberWallet,
      input.role,
      input.nonce,
    ],
    value: 0n,
  });
}

export async function setOrganizationMemberRole(input: {
  organizationId: string;
  actorWallet: string;
  memberWallet: string;
  role: "admin" | "member";
  nonce: number;
}) {
  return registryWriter().writeContract({
    address: publicConfig.registryAddress,
    functionName: "set_member_role",
    args: [
      input.organizationId,
      input.actorWallet,
      input.memberWallet,
      input.role,
      input.nonce,
    ],
    value: 0n,
  });
}

export async function removeOrganizationMember(input: {
  organizationId: string;
  actorWallet: string;
  memberWallet: string;
  nonce: number;
}) {
  return registryWriter().writeContract({
    address: publicConfig.registryAddress,
    functionName: "remove_member",
    args: [input.organizationId, input.actorWallet, input.memberWallet, input.nonce],
    value: 0n,
  });
}

export async function readOrganization(id: string): Promise<Organization | undefined> {
  const value = await registryReader().readContract({
    address: publicConfig.registryAddress,
    functionName: "get_organization",
    args: [id],
  });
  return typeof value === "string" && value ? (JSON.parse(value) as Organization) : undefined;
}

export async function readMemberRole(organizationId: string, wallet: string) {
  const value = await registryReader().readContract({
    address: publicConfig.registryAddress,
    functionName: "get_member_role",
    args: [organizationId, wallet],
  });
  return typeof value === "string" ? value : "";
}

export async function readWalletOrganizations(wallet: string) {
  const count = Number(
    await registryReader().readContract({
      address: publicConfig.registryAddress,
      functionName: "get_wallet_organization_count",
      args: [wallet],
    }),
  );
  const ids = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      registryReader().readContract({
        address: publicConfig.registryAddress,
        functionName: "get_wallet_organization_id_at",
        args: [wallet, index],
      }),
    ),
  );
  const organizations = await Promise.all(ids.map((id) => readOrganization(String(id))));
  return organizations.filter((item): item is Organization => Boolean(item));
}

export async function readOrganizationMembers(organizationId: string) {
  const count = Number(
    await registryReader().readContract({
      address: publicConfig.registryAddress,
      functionName: "get_organization_member_count",
      args: [organizationId],
    }),
  );
  const wallets = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      registryReader().readContract({
        address: publicConfig.registryAddress,
        functionName: "get_organization_member_wallet_at",
        args: [organizationId, index],
      }),
    ),
  );
  const records = await Promise.all(
    wallets.map(async (wallet) => ({
      wallet: String(wallet),
      role: await readMemberRole(organizationId, String(wallet)),
    })),
  );
  return records.filter((record) => record.wallet && record.role);
}

export async function createDashboardCampaign(input: {
  campaignId: string;
  organizationId: string;
  actorWallet: string;
  name: string;
  budgetUsdcMicros: string;
  qualityThreshold: number;
  rubricVersion: string;
  rubric: Record<string, number>;
  keyHash: string;
  actionNonce: number;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "create_dashboard_campaign",
    args: [
      input.campaignId,
      input.organizationId,
      input.actorWallet,
      input.name,
      input.budgetUsdcMicros,
      input.qualityThreshold,
      input.rubricVersion,
      JSON.stringify(input.rubric),
      input.keyHash,
      input.actionNonce,
    ],
    value: 0n,
  });
}

export async function readReviewNonce(wallet: string) {
  return Number(
    await reader().readContract({
      address: publicConfig.contractAddress,
      functionName: "get_wallet_action_nonce",
      args: [wallet],
    }),
  );
}

export async function rotateCampaignKey(input: {
  campaignId: string;
  organizationId: string;
  actorWallet: string;
  keyHash: string;
  actionNonce: number;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "rotate_campaign_api_key",
    args: [
      input.campaignId,
      input.organizationId,
      input.actorWallet,
      input.keyHash,
      input.actionNonce,
    ],
    value: 0n,
  });
}

export async function revokeCampaignKey(input: {
  campaignId: string;
  organizationId: string;
  actorWallet: string;
  actionNonce: number;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "revoke_campaign_api_key",
    args: [
      input.campaignId,
      input.organizationId,
      input.actorWallet,
      input.actionNonce,
    ],
    value: 0n,
  });
}

export async function submitBatchReview(input: {
  reviewId: string;
  reviewKey: string;
  candidates: ContributionInput[];
  keyHash: string;
  idempotencyKey: string;
  appealContext: string;
}) {
  return writer().writeContract({
    address: publicConfig.contractAddress,
    functionName: "request_batch_review",
    args: [
      input.reviewId,
      input.reviewKey,
      JSON.stringify(input.candidates),
      input.keyHash,
      input.idempotencyKey,
      input.appealContext,
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

export async function readOrganizationCampaigns(
  organizationId: string,
): Promise<CampaignRecord[]> {
  const count = Number(
    await reader().readContract({
      address: publicConfig.contractAddress,
      functionName: "get_organization_campaign_count",
      args: [organizationId],
    }),
  );
  const ids = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      reader().readContract({
        address: publicConfig.contractAddress,
        functionName: "get_organization_campaign_id_at",
        args: [organizationId, index],
      }),
    ),
  );
  const campaigns = await Promise.all(ids.map((id) => readCampaign(String(id))));
  return campaigns.filter((item): item is CampaignRecord => Boolean(item));
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

async function readReviewIds(
  countFunction: string,
  indexFunction: string,
  owner: string,
) {
  const count = Number(
    await reader().readContract({
      address: publicConfig.contractAddress,
      functionName: countFunction,
      args: [owner],
    }),
  );
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      reader().readContract({
        address: publicConfig.contractAddress,
        functionName: indexFunction,
        args: [owner, index],
      }),
    ),
  );
}

export async function readOrganizationReviews(organizationId: string) {
  const ids = await readReviewIds(
    "get_organization_review_count",
    "get_organization_review_id_at",
    organizationId,
  );
  const reviews = await Promise.all(ids.map((id) => readReview(String(id))));
  return reviews.filter((item): item is StoredReview => Boolean(item)).reverse();
}

export async function readCampaignReviews(campaignId: string) {
  const ids = await readReviewIds(
    "get_campaign_review_count",
    "get_campaign_review_id_at",
    campaignId,
  );
  const reviews = await Promise.all(ids.map((id) => readReview(String(id))));
  return reviews.filter((item): item is StoredReview => Boolean(item)).reverse();
}

export async function readWalletReviews(wallet: string) {
  const count = Number(
    await reader().readContract({
      address: publicConfig.contractAddress,
      functionName: "get_wallet_review_count",
      args: [wallet],
    }),
  );
  const ids = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      reader().readContract({
        address: publicConfig.contractAddress,
        functionName: "get_wallet_review_id_at",
        args: [wallet, index],
      }),
    ),
  );
  const reviews = await Promise.all(ids.map((id) => readReview(String(id))));
  return reviews.filter((item): item is StoredReview => Boolean(item)).reverse();
}

export async function readTransaction(hash: `0x${string}`) {
  const transaction = await reader().getTransaction({
    hash: hash as `0x${string}` & { length: 66 },
  });
  const raw = transaction as typeof transaction & {
    resultName?: string;
    result?: number;
    consensusData?: {
      validators?: Array<{
        genvmResult?: {
          errorCode?: string | null;
          errorDescription?: string | null;
        };
      }>;
    };
  };
  const validatorError = raw.consensusData?.validators
    ?.map((validator) => validator.genvmResult)
    .find((result) => result?.errorDescription || result?.errorCode);
  return {
    status: transaction.statusName ?? TransactionStatus.PENDING,
    executionResult: transaction.txExecutionResultName ?? ExecutionResult.NOT_VOTED,
    consensusResult: raw.resultName ?? null,
    resultCode: raw.result ?? null,
    error: validatorError
      ? {
          code: validatorError.errorCode ?? null,
          message: validatorError.errorDescription ?? "GenVM execution failed.",
        }
      : null,
  };
}
