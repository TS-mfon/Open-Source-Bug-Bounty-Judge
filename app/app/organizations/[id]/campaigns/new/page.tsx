"use client";

import { ArrowLeft, ArrowRight, Check, Clipboard, KeyRound, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAutoRefresh } from "@/components/use-auto-refresh";
import {
  generateCampaignKey,
  hashCampaignKey,
  useWallet,
} from "@/components/wallet-provider";
import { apiErrorMessage, validationMessage } from "@/lib/client-errors";
import { campaignDashboardPayloadSchema } from "@/lib/schemas";

const defaultRubric = {
  correctness: 25,
  tests: 20,
  maintainability: 15,
  scope_alignment: 15,
  impact: 15,
  complexity: 10,
};

export default function NewCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const { wallet, signAction } = useWallet();
  const [step, setStep] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyHash, setKeyHash] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [activationStatus, setActivationStatus] = useState<"idle" | "pending" | "finalized" | "failed">("idle");
  const [details, setDetails] = useState({
    id: "",
    name: "",
    budget: "10000",
    threshold: "70",
  });

  const loadNonce = useCallback(async () => {
    if (!wallet || !id) return;
    const response = await fetch(
      `/api/app/organizations/${id}/campaigns?wallet=${wallet}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const value = await response.json();
    setNonce(value.nonce ?? 0);
  }, [wallet, id]);
  useAutoRefresh(loadNonce, Boolean(wallet && id));

  const verifyCampaign = useCallback(async (hash = transactionHash, expectedHash = keyHash) => {
    if (!hash || !expectedHash) return;
    setActivationStatus("pending");
    setNotice("");
    try {
      const response = await fetch(
        `/api/app/organizations/${id}/campaigns/${details.id}/status?transactionHash=${encodeURIComponent(hash)}&expectedKeyHash=${expectedHash}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(result, "Unable to verify campaign"));
      if (result.status === "finalized") {
        setActivationStatus("finalized");
        return;
      }
      if (result.status === "failed") {
        setActivationStatus("failed");
        setNotice(result.error?.message ?? "GenLayer rejected the campaign transaction.");
        return;
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to verify campaign.");
    }
  }, [details.id, id, keyHash, transactionHash]);
  useAutoRefresh(verifyCampaign, activationStatus === "pending", 15_000);

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDetails({
      id: String(form.get("campaignId")).trim(),
      name: String(form.get("name")).trim(),
      budget: String(form.get("budget")),
      threshold: String(form.get("threshold")),
    });
    setStep(2);
  }

  async function createCampaign() {
    setBusy(true);
    setNotice("");
    try {
      const secret = generateCampaignKey();
      const generatedHash = await hashCampaignKey(secret);
      const candidatePayload = {
        id: details.id,
        organizationId: id,
        name: details.name,
        budgetUsdcMicros: String(Math.round(Number(details.budget) * 1_000_000)),
        qualityThreshold: Number(details.threshold),
        rubricVersion: "code-v1",
        rubric: defaultRubric,
        keyHash: generatedHash,
      };
      const parsed = campaignDashboardPayloadSchema.safeParse(candidatePayload);
      if (!parsed.success) {
        throw new Error(
          validationMessage(parsed.error.issues, "Campaign details are invalid."),
        );
      }
      const payload = parsed.data;
      const envelope = await signAction("campaign.create", payload, nonce);
      const response = await fetch(`/api/app/organizations/${id}/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(result, "Campaign creation failed"));
      }
      setApiKey(secret);
      setKeyHash(generatedHash);
      setTransactionHash(result.transactionHash);
      setActivationStatus("pending");
      setStep(4);
      void verifyCampaign(result.transactionHash, generatedHash);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell organizationId={id} title="Create campaign" description="Configure the campaign, sign once, and issue its review key.">
      <div className="wizard-progress">
        {["Details", "Scoring", "Review", "API key"].map((label, index) => (
          <div key={label} className={step >= index + 1 ? "active" : ""}>
            <i>{step > index + 1 ? <Check size={13} /> : index + 1}</i><span>{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <section className="wizard-panel">
          <div className="section-heading"><span>Step 1</span><h2>Campaign details</h2><p>Qualifying issue fixes receive a score-based recommendation from $20 to $60 USDC while budget remains.</p></div>
          <form className="form-grid" onSubmit={saveDetails}>
            <label className="full-field">Campaign name<input name="name" required defaultValue={details.name} placeholder="Stellar Builders Sprint" /></label>
            <label>Campaign ID<input name="campaignId" required defaultValue={details.id} placeholder="stellar-builders-2026" /></label>
            <label>Budget in USDC<input name="budget" type="number" min="5000" step="0.01" required defaultValue={details.budget} /></label>
            <label>Quality threshold<input name="threshold" type="number" min="50" max="95" required defaultValue={details.threshold} /></label>
            <div className="form-footer"><button className="primary-button">Continue <ArrowRight size={16} /></button></div>
          </form>
        </section>
      )}

      {step === 2 && (
        <section className="wizard-panel">
          <div className="section-heading"><span>Step 2</span><h2>Scoring profile</h2><p>The default code rubric balances correctness, tests, maintainability, scope, impact, and complexity.</p></div>
          <div className="rubric-list">
            {Object.entries(defaultRubric).map(([name, weight]) => (
              <div key={name}><span>{name.replace("_", " ")}</span><div><i style={{ width: `${weight * 2.5}%` }} /></div><b>{weight}%</b></div>
            ))}
          </div>
          <div className="wizard-actions"><button className="secondary-button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button><button className="primary-button" onClick={() => setStep(3)}>Review campaign <ArrowRight size={16} /></button></div>
        </section>
      )}

      {step === 3 && (
        <section className="wizard-panel">
          <div className="section-heading"><span>Step 3</span><h2>Confirm and sign</h2><p>Your wallet authorizes creation. The platform wallet submits the GenLayer transaction.</p></div>
          <dl className="review-summary">
            <div><dt>Name</dt><dd>{details.name}</dd></div>
            <div><dt>Campaign ID</dt><dd>{details.id}</dd></div>
            <div><dt>Budget</dt><dd>${Number(details.budget).toLocaleString()} USDC</dd></div>
            <div><dt>Threshold</dt><dd>{details.threshold}/100</dd></div>
            <div><dt>Reward policy</dt><dd>$20 / $40 / $60 per qualifying fix</dd></div>
          </dl>
          <div className="wizard-actions"><button className="secondary-button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button><button className="primary-button" onClick={() => void createCampaign()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} Sign and create</button></div>
        </section>
      )}

      {step === 4 && (
        <section className="wizard-panel key-reveal">
          <div className="key-icon">{activationStatus === "pending" ? <LoaderCircle className="spin" size={24} /> : activationStatus === "failed" ? <TriangleAlert size={24} /> : <KeyRound size={24} />}</div>
          <div className="section-heading">
            <span>{activationStatus === "finalized" ? "Campaign finalized" : activationStatus === "failed" ? "Campaign failed" : "Finalizing on GenLayer"}</span>
            <h2>{activationStatus === "finalized" ? "Your API key is active" : "Keep this page open"}</h2>
            <p>{activationStatus === "finalized" ? "The campaign and matching SHA-256 key hash are confirmed on-chain. The plaintext cannot be recovered." : "The plaintext key is shown while consensus completes. Do not use it until this page confirms that its hash is active on-chain."}</p>
          </div>
          <div className="secret-field"><code>{apiKey}</code><button className="icon-button" onClick={() => void navigator.clipboard.writeText(apiKey)} aria-label="Copy API key"><Clipboard size={17} /></button></div>
          <div className={`activation-banner ${activationStatus}`}>
            {activationStatus === "finalized" ? <Check size={16} /> : activationStatus === "failed" ? <TriangleAlert size={16} /> : <LoaderCircle className="spin" size={16} />}
            <span>{activationStatus === "finalized" ? "Active and ready for API requests" : activationStatus === "failed" ? "Not active. Review the error before retrying." : "Waiting for transaction finalization and campaign indexing"}</span>
            {activationStatus !== "finalized" && <button className="secondary-button" onClick={() => void verifyCampaign()}><RefreshCw size={14} /> Check now</button>}
          </div>
          <pre className="code-block">{`curl -X POST https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Idempotency-Key: review-batch-001" \\
  -H "Content-Type: application/json" \\
  -d '{"candidates":[{"pullRequestUrl":"https://github.com/owner/repo/pull/123","issueNumber":100,"contributionType":"code"}]}'`}</pre>
          {activationStatus === "finalized" && <Link className="primary-button" href={`/app/organizations/${id}`}>Open organization <ArrowRight size={16} /></Link>}
        </section>
      )}
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
