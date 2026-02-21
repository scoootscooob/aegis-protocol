"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="minimal"
          customTheme={{
            "--ck-font-family": '"JetBrains Mono", monospace',
            "--ck-accent-color": "#C84B31",
            "--ck-accent-text-color": "#FAF9F6",
            "--ck-body-background": "#FAF9F6",
            "--ck-body-color": "#1A1918",
            "--ck-border-radius": "0",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
