"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type EthereumProvider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "accountsChanged", listener: (accounts: string[]) => void) => void;
  removeListener?: (
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ) => void;
};

type WalletContextValue = {
  wallet: string;
  connect: () => Promise<string>;
  signAction: (action: string, payload: unknown, nonce: number) => Promise<Record<string, unknown>>;
  signReview: (input: {
    repository: string;
    pullRequestNumber: number;
    headSha: string;
  }) => Promise<{ signature: string; expiresAt: number }>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const CONNECTION_KEY = "oss-judge.wallet-connected";

function provider() {
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState("");

  useEffect(() => {
    const ethereum = provider();
    if (!ethereum) return;

    void ethereum
      .request({ method: "eth_accounts" })
      .then((value) => {
        const accounts = value as string[];
        const account = accounts[0] ?? "";
        if (account || window.localStorage.getItem(CONNECTION_KEY) === "true") {
          setWallet(account);
        }
      })
      .catch(() => undefined);

    if (!ethereum.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      const account = accounts[0] ?? "";
      setWallet(account);
      if (account) {
        window.localStorage.setItem(CONNECTION_KEY, "true");
      } else {
        window.localStorage.removeItem(CONNECTION_KEY);
      }
    };
    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
  }, []);

  const connect = useCallback(async () => {
    const ethereum = provider();
    if (!ethereum) throw new Error("Install an EVM-compatible wallet.");
    const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts[0] ?? "";
    if (!account) throw new Error("No wallet account was selected.");
    setWallet(account);
    window.localStorage.setItem(CONNECTION_KEY, "true");
    return account;
  }, []);

  const signAction = useCallback(
    async (action: string, payload: unknown, nonce: number) => {
      const ethereum = provider();
      const activeWallet = wallet || (await connect());
      if (!ethereum) throw new Error("Wallet provider is unavailable.");
      const payloadHash = await sha256(canonicalJson(payload));
      const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
      const message = [
        "Open Source Bug Bounty Judge",
        `Wallet: ${activeWallet.toLowerCase()}`,
        `Action: ${action}`,
        `Payload hash: ${payloadHash}`,
        `Nonce: ${nonce}`,
        `Expires at: ${expiresAt}`,
      ].join("\n");
      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [message, activeWallet],
      })) as string;
      return {
        wallet: activeWallet,
        signature,
        action,
        payloadHash,
        nonce,
        expiresAt,
        payload,
      };
    },
    [connect, wallet],
  );

  const signReview = useCallback(
    async (input: { repository: string; pullRequestNumber: number; headSha: string }) => {
      const ethereum = provider();
      const activeWallet = wallet || (await connect());
      if (!ethereum) throw new Error("Wallet provider is unavailable.");
      const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
      const message = [
        "Open Source Bug Bounty Judge",
        `Wallet: ${activeWallet.toLowerCase()}`,
        `Repository: ${input.repository.toLowerCase()}`,
        `Pull request: ${input.pullRequestNumber}`,
        `Head SHA: ${input.headSha.toLowerCase()}`,
        `Expires at: ${expiresAt}`,
      ].join("\n");
      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [message, activeWallet],
      })) as string;
      return { signature, expiresAt };
    },
    [connect, wallet],
  );

  const value = useMemo(
    () => ({ wallet, connect, signAction, signReview }),
    [wallet, connect, signAction, signReview],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}

export async function hashCampaignKey(value: string) {
  return sha256(value);
}

export function generateCampaignKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `osj_live_${secret}`;
}
