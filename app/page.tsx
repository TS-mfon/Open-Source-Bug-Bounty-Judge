import {
  ArrowRight,
  Blocks,
  Braces,
  FileSearch,
  GitPullRequest,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { EnergyField } from "@/components/energy-field";

export default function LandingPage() {
  return (
    <div className="landing">
      <section className="hero">
        <EnergyField />
        <header className="landing-nav">
          <Link href="/" className="landing-brand"><b>OJ</b><span>OSS Judge</span></Link>
          <nav>
            <Link href="/docs">Docs</Link>
            <Link href="/app" className="nav-launch">Launch app <ArrowRight size={15} /></Link>
          </nav>
        </header>
        <div className="hero-content">
          <div className="eyebrow"><i />Evidence-backed contribution intelligence</div>
          <h1>Open Source Bug Bounty Judge</h1>
          <p>
            GenLayer validators inspect the repository, issue, pull request, changed
            source, tests, and CI before recommending which contributions deserve a
            campaign budget.
          </p>
          <div className="hero-actions">
            <Link href="/app" className="primary-action">Launch app <ArrowRight size={17} /></Link>
            <Link href="/docs" className="ghost-action">Read API docs <Braces size={17} /></Link>
          </div>
        </div>
        <div className="hero-proof">
          <span>StudioNet</span>
          <span>On-chain history</span>
          <span>Platform-relayed transactions</span>
        </div>
      </section>

      <section className="landing-band protocol-band">
        <div className="band-heading">
          <span>Protocol flow</span>
          <h2>The judgment starts with the code.</h2>
          <p>Descriptions and claimed test results are context. Fetched repository evidence is proof.</p>
        </div>
        <div className="flow-grid">
          {[
            [GitPullRequest, "Submit revisions", "Campaign clients send a complete candidate batch with immutable PR revisions."],
            [FileSearch, "Fetch evidence", "Validators retrieve issue scope, patches, changed raw files, tests, manifests, and CI."],
            [Scale, "Compare quality", "Every candidate is scored against one rubric under comparative consensus."],
            [Blocks, "Record allocation", "Rankings, citations, and exact micro-USDC recommendations are stored on GenLayer."],
          ].map(([Icon, title, copy], index) => {
            const ItemIcon = Icon as typeof GitPullRequest;
            return (
              <article key={String(title)} className="flow-item">
                <div className="flow-index">0{index + 1}</div>
                <ItemIcon size={22} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-band trust-band">
        <div className="trust-copy">
          <span>Designed for OSS platforms</span>
          <h2>One campaign key. No hidden review database.</h2>
          <p>
            Organizations create campaigns from a wallet-authenticated dashboard.
            Their integrations use campaign-scoped keys to request reviews and read
            on-chain results. The platform wallet relays every GenLayer write.
          </p>
          <Link href="/docs">Explore the integration model <ArrowRight size={16} /></Link>
        </div>
        <div className="trust-terminal">
          <div className="terminal-bar"><i /><i /><i /><span>POST /api/v1/reviews</span></div>
          <pre>{`{
  "candidates": [
    {
      "repository": "owner/project",
      "issueNumber": 135,
      "pullRequestNumber": 197,
      "headSha": "46b2ac67..."
    }
  ]
}`}</pre>
          <div className="terminal-status"><ShieldCheck size={16} /> Platform signer configured</div>
        </div>
      </section>

      <footer className="landing-footer">
        <div><b>OSS Judge</b><span>Review intelligence on GenLayer</span></div>
        <div><Link href="/app">App</Link><Link href="/docs">Docs</Link><a href="https://github.com/TS-mfon/Open-Source-Bug-Bounty-Judge">GitHub</a></div>
      </footer>
    </div>
  );
}
