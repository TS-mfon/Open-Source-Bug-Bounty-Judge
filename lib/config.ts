const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const publicConfig = {
  contractAddress:
    (process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
    ZERO_ADDRESS,
  registryAddress:
    (process.env.NEXT_PUBLIC_GENLAYER_REGISTRY_ADDRESS as `0x${string}` | undefined) ??
    ZERO_ADDRESS,
  network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
  directoryAddress:
    (process.env.NEXT_PUBLIC_GENLAYER_DIRECTORY_ADDRESS as `0x${string}` | undefined) ??
    ZERO_ADDRESS,
};

export function getServerConfig() {
  return {
    privateKey: process.env.GENLAYER_PLATFORM_PRIVATE_KEY ?? "",
    adminSecret: process.env.PLATFORM_ADMIN_SECRET ?? "",
    webhookSecret: process.env.WEBHOOK_SIGNING_SECRET ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export const isContractConfigured = publicConfig.contractAddress !== ZERO_ADDRESS;
export const isRegistryConfigured = publicConfig.registryAddress !== ZERO_ADDRESS;
export const isDirectoryConfigured = publicConfig.directoryAddress !== ZERO_ADDRESS;
