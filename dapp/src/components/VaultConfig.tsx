"use client";

import { useState, useEffect, useCallback } from "react";
import { formatEther, type Address } from "viem";
import {
  useModuleAddresses,
  useVelocityConfig,
  useDrawdownConfig,
  useConfigureVelocity,
  useConfigureDrawdown,
  useWhitelistCount,
  useAddTarget,
  useRemoveTarget,
  useAddTargets,
} from "@/hooks/useVault";
import { useReadContract } from "wagmi";
import { WHITELIST_MODULE_ABI } from "@/lib/contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

// ── Well-known Base DeFi protocols for one-click whitelisting ──

const BASE_DEFI_PROTOCOLS: { name: string; address: Address }[] = [
  { name: "Uniswap Universal Router", address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { name: "Uniswap V3 Router", address: "0x2626664c2603336E57B271c5C0b26F421741e481" },
  { name: "Aerodrome Router", address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" },
  { name: "Aave V3 Pool (Base)", address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" },
  { name: "1inch Router", address: "0x1111111254EEB25477B68fb85Ed929f73A960582" },
  { name: "0x Exchange Proxy", address: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF" },
  { name: "Moonwell Base", address: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C" },
  { name: "WETH (Base)", address: "0x4200000000000000000000000000000000000006" },
];

interface Props {
  vaultAddress: Address;
}

// ── Whitelist entries reader component ──

function WhitelistEntries({
  whitelistAddr,
  count,
}: {
  whitelistAddr: Address;
  count: number;
}) {
  // Read up to 20 whitelist entries
  const maxEntries = Math.min(count, 20);
  const entries: { address: Address; isActive: boolean }[] = [];

  // We'll read all entries with individual hooks
  // This is a simplified approach — for large lists, a multicall would be better
  const e0 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(0)], query: { enabled: maxEntries > 0 } });
  const e1 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(1)], query: { enabled: maxEntries > 1 } });
  const e2 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(2)], query: { enabled: maxEntries > 2 } });
  const e3 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(3)], query: { enabled: maxEntries > 3 } });
  const e4 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(4)], query: { enabled: maxEntries > 4 } });
  const e5 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(5)], query: { enabled: maxEntries > 5 } });
  const e6 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(6)], query: { enabled: maxEntries > 6 } });
  const e7 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(7)], query: { enabled: maxEntries > 7 } });
  const e8 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(8)], query: { enabled: maxEntries > 8 } });
  const e9 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelistedList", args: [BigInt(9)], query: { enabled: maxEntries > 9 } });

  // Verify each is still active (removeTarget sets mapping to false)
  const v0 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e0.data as Address], query: { enabled: !!e0.data } });
  const v1 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e1.data as Address], query: { enabled: !!e1.data } });
  const v2 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e2.data as Address], query: { enabled: !!e2.data } });
  const v3 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e3.data as Address], query: { enabled: !!e3.data } });
  const v4 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e4.data as Address], query: { enabled: !!e4.data } });
  const v5 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e5.data as Address], query: { enabled: !!e5.data } });
  const v6 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e6.data as Address], query: { enabled: !!e6.data } });
  const v7 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e7.data as Address], query: { enabled: !!e7.data } });
  const v8 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e8.data as Address], query: { enabled: !!e8.data } });
  const v9 = useReadContract({ address: whitelistAddr, abi: WHITELIST_MODULE_ABI, functionName: "whitelisted", args: [e9.data as Address], query: { enabled: !!e9.data } });

  const allEntries = [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9];
  const allVerify = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9];

  const removeTarget = useRemoveTarget();

  const activeEntries: Address[] = [];
  for (let i = 0; i < maxEntries && i < 10; i++) {
    const addr = allEntries[i].data as Address | undefined;
    const isActive = allVerify[i].data as boolean | undefined;
    if (addr && isActive) {
      activeEntries.push(addr);
    }
  }

  // Find protocol name for an address
  const getProtocolName = (addr: string) => {
    const found = BASE_DEFI_PROTOCOLS.find(
      (p) => p.address.toLowerCase() === addr.toLowerCase()
    );
    return found?.name;
  };

  if (activeEntries.length === 0) {
    return (
      <p className="font-mono text-[10px] text-ink/40 italic">
        No targets whitelisted yet. Add addresses below to enable the whitelist gate.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {activeEntries.map((addr) => {
        const protocolName = getProtocolName(addr);
        return (
          <div
            key={addr}
            className="flex items-center gap-2 p-2 border border-ink/10 bg-surface"
          >
            <div className="flex-1 min-w-0">
              {protocolName && (
                <span className="font-mono text-[10px] text-terracotta block">
                  {protocolName}
                </span>
              )}
              <code className="font-mono text-xs text-ink truncate block">
                {addr}
              </code>
            </div>
            <button
              className="font-mono text-[10px] text-ink/40 hover:text-terracotta transition-colors px-2 py-1 border border-ink/10 hover:border-terracotta/40"
              onClick={() => removeTarget.removeTarget(whitelistAddr, addr)}
              disabled={removeTarget.isPending || removeTarget.isConfirming}
            >
              {removeTarget.isPending ? "..." : "Remove"}
            </button>
          </div>
        );
      })}
      {count > 10 && (
        <p className="font-mono text-[10px] text-ink/40">
          + {count - 10} more entries (showing first 10)
        </p>
      )}
    </div>
  );
}

// ── Main VaultConfig Component ──

export function VaultConfig({ vaultAddress }: Props) {
  const modules = useModuleAddresses(vaultAddress);

  const velocityAddr = (modules.velocity.data as Address) || ZERO_ADDRESS;
  const drawdownAddr = (modules.drawdown.data as Address) || ZERO_ADDRESS;
  const whitelistAddr = (modules.whitelist.data as Address) || ZERO_ADDRESS;

  const hasVelocity = velocityAddr !== ZERO_ADDRESS;
  const hasDrawdown = drawdownAddr !== ZERO_ADDRESS;
  const hasWhitelist = whitelistAddr !== ZERO_ADDRESS;

  const velocityConfig = useVelocityConfig(hasVelocity ? velocityAddr : ZERO_ADDRESS);
  const drawdownBps = useDrawdownConfig(hasDrawdown ? drawdownAddr : ZERO_ADDRESS);
  const whitelistCount = useWhitelistCount(hasWhitelist ? whitelistAddr : ZERO_ADDRESS);

  const configureVelocity = useConfigureVelocity();
  const configureDrawdown = useConfigureDrawdown();
  const addTarget = useAddTarget();
  const addTargets = useAddTargets();

  // Form state
  const [maxPerHour, setMaxPerHour] = useState("");
  const [maxSingleTx, setMaxSingleTx] = useState("");
  const [drawdownPct, setDrawdownPct] = useState("");
  const [newTarget, setNewTarget] = useState("");

  // Populate form from on-chain values
  useEffect(() => {
    if (velocityConfig.maxPerHour.data != null) {
      setMaxPerHour(formatEther(velocityConfig.maxPerHour.data as bigint));
    }
  }, [velocityConfig.maxPerHour.data]);

  useEffect(() => {
    if (velocityConfig.maxSingleTx.data != null) {
      setMaxSingleTx(formatEther(velocityConfig.maxSingleTx.data as bigint));
    }
  }, [velocityConfig.maxSingleTx.data]);

  useEffect(() => {
    if (drawdownBps.data != null) {
      setDrawdownPct(String(Number(drawdownBps.data) / 100));
    }
  }, [drawdownBps.data]);

  const handleSaveVelocity = () => {
    if (!hasVelocity || !maxPerHour || !maxSingleTx) return;
    configureVelocity.configure(velocityAddr, maxPerHour, maxSingleTx);
  };

  const handleSaveDrawdown = () => {
    if (!hasDrawdown || !drawdownPct) return;
    const bps = Math.round(parseFloat(drawdownPct) * 100);
    if (bps < 1 || bps > 10000) return;
    configureDrawdown.configure(drawdownAddr, bps);
  };

  const handleAddTarget = () => {
    if (!hasWhitelist || !newTarget.startsWith("0x") || newTarget.length !== 42) return;
    addTarget.addTarget(whitelistAddr, newTarget as Address);
    setNewTarget("");
  };

  const handleAddProtocol = (addr: Address) => {
    if (!hasWhitelist) return;
    addTarget.addTarget(whitelistAddr, addr);
  };

  const handleAddAllProtocols = () => {
    if (!hasWhitelist) return;
    addTargets.addTargets(
      whitelistAddr,
      BASE_DEFI_PROTOCOLS.map((p) => p.address)
    );
  };

  const velocitySaving = configureVelocity.isPending || configureVelocity.isConfirming;
  const drawdownSaving = configureDrawdown.isPending || configureDrawdown.isConfirming;
  const whitelistSaving = addTarget.isPending || addTarget.isConfirming || addTargets.isPending || addTargets.isConfirming;

  const wlCount = whitelistCount.data != null ? Number(whitelistCount.data) : 0;

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-ink/60 mb-6 tracking-widest uppercase">
        Vault Configuration
      </h3>

      {/* Target Whitelist */}
      {hasWhitelist && (
        <div className="mb-6">
          <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase block mb-3">
            [ Target_Whitelist ]
          </span>
          <p className="font-mono text-[10px] text-ink/40 mb-3 leading-relaxed">
            Only addresses on this list can receive transactions from your agent.
            The RPC proxy blocks all other destinations before the 7-engine firewall runs.
          </p>

          {/* Current whitelist entries */}
          <div className="mb-4">
            <span className="font-mono text-[10px] text-ink/60 block mb-2">
              Active targets ({wlCount})
            </span>
            <WhitelistEntries whitelistAddr={whitelistAddr} count={wlCount} />
          </div>

          {/* Add custom address */}
          <div className="flex gap-2 mb-3">
            <input
              className="input-field text-sm flex-1"
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="0x... contract address"
            />
            <button
              className="btn-primary text-xs whitespace-nowrap"
              disabled={whitelistSaving || !newTarget}
              onClick={handleAddTarget}
            >
              {addTarget.isPending
                ? "Signing..."
                : addTarget.isConfirming
                  ? "Confirming..."
                  : addTarget.isSuccess
                    ? "Added"
                    : "Add Target"}
            </button>
          </div>

          {/* One-click DeFi protocols */}
          <div className="border border-ink/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-ink/60">
                Base DeFi Quick-Add
              </span>
              <button
                className="font-mono text-[10px] text-terracotta hover:text-ink transition-colors"
                disabled={whitelistSaving}
                onClick={handleAddAllProtocols}
              >
                {addTargets.isPending
                  ? "Signing..."
                  : addTargets.isConfirming
                    ? "Confirming..."
                    : addTargets.isSuccess
                      ? "Added All"
                      : "Add All"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {BASE_DEFI_PROTOCOLS.map((protocol) => (
                <button
                  key={protocol.address}
                  className="text-left p-2 border border-ink/10 hover:border-ink/30 transition-colors"
                  disabled={whitelistSaving}
                  onClick={() => handleAddProtocol(protocol.address)}
                >
                  <span className="font-mono text-[10px] text-ink block">
                    {protocol.name}
                  </span>
                  <code className="font-mono text-[9px] text-ink/40 truncate block">
                    {protocol.address}
                  </code>
                </button>
              ))}
            </div>
          </div>

          {(addTarget.error || addTargets.error) && (
            <p className="font-mono text-xs text-terracotta mt-2">
              {((addTarget.error || addTargets.error) as Error).message?.includes("User rejected")
                ? "Transaction rejected."
                : ((addTarget.error || addTargets.error) as Error).message?.slice(0, 150)}
            </p>
          )}
        </div>
      )}

      {/* Velocity Limits */}
      {hasVelocity && (
        <div className="mb-6">
          <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase block mb-3">
            [ Velocity_Limits ]
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="label-text">Max Per Hour (ETH)</label>
              <input
                className="input-field text-sm"
                type="number"
                value={maxPerHour}
                onChange={(e) => setMaxPerHour(e.target.value)}
                step="0.1"
                min="0"
              />
            </div>
            <div>
              <label className="label-text">Max Per Transaction (ETH)</label>
              <input
                className="input-field text-sm"
                type="number"
                value={maxSingleTx}
                onChange={(e) => setMaxSingleTx(e.target.value)}
                step="0.1"
                min="0"
              />
            </div>
          </div>
          <button
            className="btn-primary text-xs"
            disabled={velocitySaving}
            onClick={handleSaveVelocity}
          >
            {configureVelocity.isPending
              ? "Signing..."
              : configureVelocity.isConfirming
                ? "Confirming..."
                : configureVelocity.isSuccess
                  ? "Saved"
                  : "Update Velocity Limits"}
          </button>
          {configureVelocity.error && (
            <p className="font-mono text-xs text-terracotta mt-2">
              {(configureVelocity.error as Error).message?.includes("User rejected")
                ? "Transaction rejected."
                : (configureVelocity.error as Error).message?.slice(0, 150)}
            </p>
          )}
        </div>
      )}

      {/* Drawdown Guard */}
      {hasDrawdown && (
        <div className="mb-6">
          <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase block mb-3">
            [ Drawdown_Guard ]
          </span>
          <div className="mb-3">
            <label className="label-text">Max Drawdown (%)</label>
            <input
              className="input-field text-sm"
              type="number"
              value={drawdownPct}
              onChange={(e) => setDrawdownPct(e.target.value)}
              step="0.5"
              min="0.01"
              max="100"
            />
            <span className="font-mono text-[10px] text-ink/40 mt-1 block">
              {drawdownPct ? `${drawdownPct}% = ${Math.round(parseFloat(drawdownPct || "0") * 100)} bps` : ""}
            </span>
          </div>
          <button
            className="btn-primary text-xs"
            disabled={drawdownSaving}
            onClick={handleSaveDrawdown}
          >
            {configureDrawdown.isPending
              ? "Signing..."
              : configureDrawdown.isConfirming
                ? "Confirming..."
                : configureDrawdown.isSuccess
                  ? "Saved"
                  : "Update Drawdown Guard"}
          </button>
          {configureDrawdown.error && (
            <p className="font-mono text-xs text-terracotta mt-2">
              {(configureDrawdown.error as Error).message?.includes("User rejected")
                ? "Transaction rejected."
                : (configureDrawdown.error as Error).message?.slice(0, 150)}
            </p>
          )}
        </div>
      )}

      {!hasVelocity && !hasDrawdown && !hasWhitelist && (
        <p className="font-mono text-xs text-ink/40">
          No configurable modules found on this vault.
        </p>
      )}
    </div>
  );
}
