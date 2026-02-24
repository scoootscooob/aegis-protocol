/**
 * Wagmi + ConnectKit configuration for Plimsoll dApp.
 *
 * Primary chain: Base (8453) — where vaults are deployed.
 * Sepolia kept for testing.
 */

import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { base, sepolia, mainnet } from "wagmi/chains";

export const config = createConfig(
  getDefaultConfig({
    chains: [base, mainnet, sepolia],
    transports: {
      [base.id]: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL ||
          "https://mainnet.base.org"
      ),
      [mainnet.id]: http(
        process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
          "https://cloudflare-eth.com"
      ),
      [sepolia.id]: http(
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
          "https://rpc.sepolia.org"
      ),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    appName: "Plimsoll Capital Delegation",
    appDescription: "Manage AI agent vaults with on-chain physics enforcement",
    appUrl: "https://plimsoll.network",
    enableFamily: true,
  })
);
