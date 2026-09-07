import { readFile, writeFile } from "node:fs/promises";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const key = process.env.GENLAYER_OPERATOR_PRIVATE_KEY ?? "";
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("GENLAYER_OPERATOR_PRIVATE_KEY is invalid");
const account = createAccount(key);
const client = createClient({ chain: studionet, account });
const manifest = JSON.parse(await readFile("deployment.studionet.json", "utf8"));
const directory = manifest.protocolDirectory.contractAddress;
const activeReview = manifest.reviewProtocol.contractAddress;
const hash = await client.writeContract({
  address: directory,
  functionName: "set_active_contract",
  args: ["review_protocol", activeReview, "v1"],
  value: 0n,
});
const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 5000, retries: 180 });
const status = String(receipt.statusName ?? receipt.status_name ?? "");
const execution = String(receipt.txExecutionResultName ?? receipt.execution_result ?? "");
if (execution.includes("ERROR") || status === "REVERTED") throw new Error(`Directory activation failed: ${JSON.stringify(receipt).slice(0, 1000)}`);
manifest.protocolDirectory.activationTransactionHash = hash;
manifest.protocolDirectory.activeReviewProtocol = activeReview;
manifest.updatedAt = new Date().toISOString();
await writeFile("deployment.studionet.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ directory, activeReview, hash, status }, null, 2));
