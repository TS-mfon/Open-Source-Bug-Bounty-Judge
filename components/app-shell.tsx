"use client";

import {
  BookOpen,
  Building2,
  FileClock,
  GitPullRequest,
  LayoutDashboard,
  Menu,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWallet } from "./wallet-provider";

export function AppShell({
  children,
  title,
  description,
  organizationId,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  organizationId?: string;
}) {
  const { wallet, connect } = useWallet();
  const [open, setOpen] = useState(false);
  const orgBase = organizationId ? `/app/organizations/${organizationId}` : "";

  const links = organizationId
    ? [
        [LayoutDashboard, "Overview", orgBase],
        [FileClock, "Review history", `${orgBase}/history`],
        [Users, "Members", `${orgBase}/members`],
        [BookOpen, "API docs", "/docs"],
      ]
    : [
        [LayoutDashboard, "Workspaces", "/app"],
        [GitPullRequest, "Individual review", "/app/individual"],
        [Building2, "Organizations", "/app"],
        [BookOpen, "API docs", "/docs"],
      ];

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-nav ${open ? "open" : ""}`}>
        <div className="dashboard-brand">
          <Link href="/" className="brand-symbol" aria-label="OSS Judge home">OJ</Link>
          <div>
            <strong>OSS Judge</strong>
            <span>StudioNet protocol</span>
          </div>
          <button className="icon-button nav-close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav>
          {links.map(([Icon, label, href]) => {
            const ItemIcon = Icon as typeof LayoutDashboard;
            return (
              <Link key={String(label)} href={String(href)} onClick={() => setOpen(false)}>
                <ItemIcon size={17} />
                <span>{String(label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="network-status"><i />GenLayer StudioNet</div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={19} />
          </button>
          <div className="page-heading">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <button className="wallet-button" onClick={() => void connect()}>
            <Wallet size={16} />
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect wallet"}
          </button>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
