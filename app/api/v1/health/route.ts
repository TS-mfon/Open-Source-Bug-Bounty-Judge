import { NextResponse } from "next/server";
import {
  getServerConfig,
  isContractConfigured,
  isRegistryConfigured,
  publicConfig,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "open-source-bug-bounty-judge",
    architecture: "stateless-api-onchain-storage",
    network: publicConfig.network,
    contractAddress: publicConfig.contractAddress,
    registryAddress: publicConfig.registryAddress,
    contractConfigured: isContractConfigured,
    registryConfigured: isRegistryConfigured,
    platformSignerConfigured: /^0x[0-9a-fA-F]{64}$/.test(getServerConfig().privateKey),
    timestamp: new Date().toISOString(),
  });
}
