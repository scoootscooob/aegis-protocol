"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ConnectKitButton } from "connectkit";
import { useDisconnect, useBalance, useAccount } from "wagmi";
import { formatEther } from "viem";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const { address, chain } = useAccount();

  const { data: balanceData } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="border-b border-ink/30 bg-paper sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="font-serif text-xl text-terracotta">&#x29B5;</span>
              <span className="font-serif text-xl tracking-tight text-ink">
                Plimsoll
              </span>
            </Link>
            <span className="font-mono text-[10px] text-ink/50 uppercase tracking-widest ml-2">
              Fleet Command
            </span>
          </div>

          <ConnectKitButton.Custom>
            {({ isConnected, isConnecting, show, address: ckAddress, ensName }) => {
              if (!isConnected) {
                return (
                  <button
                    onClick={show}
                    className="font-mono text-xs uppercase tracking-widest px-5 py-2 border border-ink/30 hover:border-terracotta hover:text-terracotta transition-colors duration-150"
                  >
                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                  </button>
                );
              }

              const displayName =
                ensName || `${ckAddress?.slice(0, 6)}...${ckAddress?.slice(-4)}`;
              const bal = balanceData
                ? `${parseFloat(formatEther(balanceData.value)).toFixed(4)} ${balanceData.symbol}`
                : null;

              return (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-3 font-mono text-xs px-4 py-2 border border-ink/20 hover:border-ink/40 transition-colors duration-150"
                  >
                    {/* Green connected dot */}
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="uppercase tracking-widest">{displayName}</span>
                    <svg
                      className={`w-3 h-3 text-ink/50 transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-paper border border-ink/20 shadow-lg z-50">
                      {/* Account Info */}
                      <div className="p-4 border-b border-ink/10">
                        <div className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mb-2">
                          Connected Account
                        </div>
                        <div className="font-mono text-xs text-ink break-all">
                          {ckAddress}
                        </div>
                        {bal && (
                          <div className="font-mono text-sm text-ink/80 mt-2">
                            {bal}
                          </div>
                        )}
                        {chain && (
                          <div className="font-mono text-[10px] text-terracotta mt-2 uppercase tracking-widest">
                            {chain.name}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            if (show) show();
                          }}
                          className="w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-widest text-ink/70 hover:text-ink hover:bg-surface transition-colors"
                        >
                          Switch Wallet
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            disconnect();
                          }}
                          className="w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Disconnect
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            disconnect();
                            // Clear stale WalletConnect sessions from localStorage
                            try {
                              Object.keys(localStorage).forEach((key) => {
                                if (
                                  key.startsWith("wc@") ||
                                  key.startsWith("walletconnect") ||
                                  key.startsWith("-walletlink") ||
                                  key.includes("wagmi")
                                ) {
                                  localStorage.removeItem(key);
                                }
                              });
                            } catch {}
                            window.location.reload();
                          }}
                          className="w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-widest text-ink/40 hover:text-ink/70 hover:bg-surface transition-colors border-t border-ink/10 mt-1 pt-2"
                        >
                          Reset Connection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  );
}
