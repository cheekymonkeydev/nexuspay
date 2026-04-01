import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusPay — PayPal for AI Agents",
  description: "Agent wallets, spending policies, USDC settlement on Base, x402 protocol, P2P agent payments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
