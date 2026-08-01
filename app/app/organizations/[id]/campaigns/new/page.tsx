"use client";

import { ArrowLeft, ArrowRight, Check, Clipboard, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  generateCampaignKey,
  hashCampaignKey,
  useWallet,
} from "@/components/wallet-provider";

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
  const [details, setDetails] = useState({
    id: "",
    name: "",
    budget: "10000",
    threshold: "70",
  });

  useEffect(() => {
    if (!wallet || !id) return;
    fetch(`/api/app/organizations/${id}/campaigns?wallet=${wallet}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => setNonce(value.nonce ?? 0))
      .catch(() => undefined);
  }, [wallet, id]);

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDetails({
      id: String(form.get("campaignId")),
      name: String(form.get("name")),
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
      const payload = {
        id: details.id,
        organizationId: id,
        name: details.name,
        budgetUsdcMicros: String(Math.round(Number(details.budget) * 1_000_000)),
        qualityThreshold: Number(details.threshold),
        rubricVersion: "code-v1",
        rubric: defaultRubric,
        keyHash: await hashCampaignKey(secret),
      };
      const envelope = await signAction("campaign.create", payload, nonce);
      const response = await fetch(`/api/app/organizations/${id}/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Campaign creation failed");
      setApiKey(secret);
      setStep(4);
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
          <div className="section-heading"><span>Step 1</span><h2>Campaign details</h2><p>These values define the review threshold and allocation pool.</p></div>
          <form className="form-grid" onSubmit={saveDetails}>
            <label className="full-field">Campaign name<input name="name" required defaultValue={details.name} placeholder="Stellar Builders Sprint" /></label>
            <label>Campaign ID<input name="campaignId" required defaultValue={details.id} placeholder="stellar-builders-2026" /></label>
            <label>Budget in USDC<input name="budget" type="number" min="1" step="0.01" required defaultValue={details.budget} /></label>
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
          </dl>
          <div className="wizard-actions"><button className="secondary-button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button><button className="primary-button" onClick={() => void createCampaign()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} Sign and create</button></div>
        </section>
      )}

      {step === 4 && (
        <section className="wizard-panel key-reveal">
          <div className="key-icon"><KeyRound size={24} /></div>
          <div className="section-heading"><span>Campaign submitted</span><h2>Store this API key now</h2><p>Only its SHA-256 hash is stored on-chain. The plaintext cannot be recovered.</p></div>
          <div className="secret-field"><code>{apiKey}</code><button className="icon-button" onClick={() => void navigator.clipboard.writeText(apiKey)} aria-label="Copy API key"><Clipboard size={17} /></button></div>
          <pre className="code-block">{`curl -X POST https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Idempotency-Key: review-batch-001" \\
  -H "Content-Type: application/json" \\
  -d '{"candidates":[...]}'`}</pre>
          <Link className="primary-button" href={`/app/organizations/${id}`}>Open organization <ArrowRight size={16} /></Link>
        </section>
      )}
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
