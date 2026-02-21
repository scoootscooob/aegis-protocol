"use client";

import { type Address } from "viem";
import { useEmergencyLock } from "@/hooks/useVault";

interface Props {
  vaultAddress: Address;
  isLocked: boolean;
}

export function EmergencyPanel({ vaultAddress, isLocked }: Props) {
  const { lock, unlock, isPending, isConfirming, isSuccess, error } =
    useEmergencyLock();

  return (
    <div
      className={`card border ${
        isLocked ? "border-terracotta bg-terracotta/5" : "border-ink/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-mono text-xs tracking-widest uppercase mb-2">
            {isLocked ? (
              <span className="text-terracotta">[ LOCKED ]</span>
            ) : (
              <span className="text-ink/60">[ Emergency Controls ]</span>
            )}
          </h3>
          <p className="font-mono text-sm text-ink/60">
            {isLocked
              ? "Vault is LOCKED. All session keys and executions are frozen."
              : "Lock the vault to immediately freeze all agent activity."}
          </p>
        </div>

        {isLocked ? (
          <button
            className="btn-primary"
            disabled={isPending || isConfirming}
            onClick={() => unlock(vaultAddress)}
          >
            {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Unlock Vault"}
          </button>
        ) : (
          <button
            className="btn-danger"
            disabled={isPending || isConfirming}
            onClick={() => lock(vaultAddress)}
          >
            {isPending
              ? "Signing..."
              : isConfirming
                ? "Confirming..."
                : "EMERGENCY LOCK"}
          </button>
        )}
      </div>

      {isSuccess && (
        <p className="font-mono text-sm text-ink/60 mt-2">
          {isLocked ? "Vault unlocked." : "Vault locked."}
        </p>
      )}
      {error && (
        <p className="font-mono text-sm text-terracotta mt-2">
          {(error as Error).message?.slice(0, 150)}
        </p>
      )}
    </div>
  );
}
