"use client";

import { useState, useEffect } from "react";
import { formatEther, type Address } from "viem";
import {
  useModuleAddresses,
  useVelocityConfig,
  useDrawdownConfig,
  useConfigureVelocity,
  useConfigureDrawdown,
} from "@/hooks/useVault";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

interface Props {
  vaultAddress: Address;
}

export function VaultConfig({ vaultAddress }: Props) {
  const modules = useModuleAddresses(vaultAddress);

  const velocityAddr = (modules.velocity.data as Address) || ZERO_ADDRESS;
  const drawdownAddr = (modules.drawdown.data as Address) || ZERO_ADDRESS;

  const hasVelocity = velocityAddr !== ZERO_ADDRESS;
  const hasDrawdown = drawdownAddr !== ZERO_ADDRESS;

  const velocityConfig = useVelocityConfig(hasVelocity ? velocityAddr : ZERO_ADDRESS);
  const drawdownBps = useDrawdownConfig(hasDrawdown ? drawdownAddr : ZERO_ADDRESS);

  const configureVelocity = useConfigureVelocity();
  const configureDrawdown = useConfigureDrawdown();

  // Form state
  const [maxPerHour, setMaxPerHour] = useState("");
  const [maxSingleTx, setMaxSingleTx] = useState("");
  const [drawdownPct, setDrawdownPct] = useState("");

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

  const velocitySaving = configureVelocity.isPending || configureVelocity.isConfirming;
  const drawdownSaving = configureDrawdown.isPending || configureDrawdown.isConfirming;

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-ink/60 mb-6 tracking-widest uppercase">
        Vault Configuration
      </h3>

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
        <div>
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

      {!hasVelocity && !hasDrawdown && (
        <p className="font-mono text-xs text-ink/40">
          No configurable modules found on this vault.
        </p>
      )}
    </div>
  );
}
