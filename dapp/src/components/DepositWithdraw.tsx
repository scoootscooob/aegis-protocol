"use client";

import { useState } from "react";
import { type Address } from "viem";
import { useDeposit, useWithdraw } from "@/hooks/useVault";

interface Props {
  vaultAddress: Address;
}

export function DepositWithdraw({ vaultAddress }: Props) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");

  const depositHook = useDeposit();
  const withdrawHook = useWithdraw();

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">Deposit / Withdraw</h3>

      {/* Deposit */}
      <div className="space-y-3 mb-6">
        <h4 className="font-mono text-xs text-terracotta tracking-widest uppercase">[ Deposit_ETH ]</h4>
        <div className="flex gap-2">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.0"
            step="0.01"
            min="0"
            className="input-field"
          />
          <button
            className="btn-primary whitespace-nowrap"
            disabled={
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              depositHook.isPending ||
              depositHook.isConfirming
            }
            onClick={() => depositHook.deposit(vaultAddress, depositAmount)}
          >
            {depositHook.isPending
              ? "Signing..."
              : depositHook.isConfirming
                ? "Confirming..."
                : "Deposit"}
          </button>
        </div>
        {depositHook.isSuccess && (
          <p className="font-mono text-sm text-ink/60">Deposit confirmed.</p>
        )}
        {depositHook.error && (
          <p className="font-mono text-sm text-terracotta">
            {(depositHook.error as Error).message?.slice(0, 100)}
          </p>
        )}
      </div>

      {/* Withdraw */}
      <div className="space-y-3 border-t border-ink/20 pt-4">
        <h4 className="font-mono text-xs text-terracotta tracking-widest uppercase">[ Withdraw_ETH ]</h4>
        <input
          type="text"
          value={withdrawTo}
          onChange={(e) => setWithdrawTo(e.target.value)}
          placeholder="Recipient address (0x...)"
          className="input-field text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="0.0"
            step="0.01"
            min="0"
            className="input-field"
          />
          <button
            className="btn-secondary whitespace-nowrap"
            disabled={
              !withdrawAmount ||
              parseFloat(withdrawAmount) <= 0 ||
              !withdrawTo ||
              withdrawHook.isPending ||
              withdrawHook.isConfirming
            }
            onClick={() =>
              withdrawHook.withdraw(
                vaultAddress,
                withdrawTo as Address,
                withdrawAmount
              )
            }
          >
            {withdrawHook.isPending
              ? "Signing..."
              : withdrawHook.isConfirming
                ? "Confirming..."
                : "Withdraw"}
          </button>
        </div>
        {withdrawHook.isSuccess && (
          <p className="font-mono text-sm text-ink/60">Withdrawal confirmed.</p>
        )}
        {withdrawHook.error && (
          <p className="font-mono text-sm text-terracotta">
            {(withdrawHook.error as Error).message?.slice(0, 100)}
          </p>
        )}
      </div>
    </div>
  );
}
