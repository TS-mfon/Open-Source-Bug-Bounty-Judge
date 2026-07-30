import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Source Bug Bounty Judge",
  description:
    "Evidence-backed GenLayer reviews and campaign reward allocation for open-source contributions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
