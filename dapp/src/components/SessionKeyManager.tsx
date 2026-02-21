"use client";

import { useState } from "react";
import { type Address } from "viem";
import {
  useIssueSessionKey,
  useRevokeSessionKey,
  useSessionKey,
  useSessionActive,
} from "@/hooks/useVault";
import { formatEther } from "viem";

interface Props {
  vaultAddress: Address;
}

export function SessionKeyManager({ vaultAddress }: Props) {
  const [agentAddress, setAgentAddress] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [maxSingleEth, setMaxSingleEth] = useState("0.5");
  const [dailyBudgetEth, setDailyBudgetEth] = useState("1.0");
  const [queryAgent, setQueryAgent] = useState("");

  const issueHook = useIssueSessionKey();
  const revokeHook = useRevokeSessionKey();

  // Query session info for an agent
  const sessionActive = useSessionActive(
    vaultAddress,
    (queryAgent || "0x0000000000000000000000000000000000000000") as Address
  );
  const sessionInfo = useSessionKey(
    vaultAddress,
    (queryAgent || "0x0000000000000000000000000000000000000000") as Address
  );

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">Session Key Management</h3>

      {/* Issue Session Key */}
      <div className="space-y-3 mb-6">
        <h4 className="font-mono text-xs text-terracotta tracking-widest uppercase">
          [ Issue_Key ]
        </h4>
        <input
          type="text"
          value={agentAddress}
          onChange={(e) => setAgentAddress(e.target.value)}
          placeholder="Agent address (0x...)"
          className="input-field text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label-text">Duration (hrs)</label>
            <input
              type="number"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="input-field"
              min="0.1"
              step="0.5"
            />
          </div>
          <div>
            <label className="label-text">Max Single (ETH)</label>
            <input
              type="number"
              value={maxSingleEth}
              onChange={(e) => setMaxSingleEth(e.target.value)}
              className="input-field"
              min="0.001"
              step="0.1"
            />
          </div>
          <div>
            <label className="label-text">Daily Budget (ETH)</label>
            <input
              type="number"
              value={dailyBudgetEth}
              onChange={(e) => setDailyBudgetEth(e.target.value)}
              className="input-field"
              min="0.001"
              step="0.1"
            />
          </div>
        </div>
        <button
          className="btn-primary w-full"
          disabled={
            !agentAddress ||
            issueHook.isPending ||
            issueHook.isConfirming
          }
          onClick={() =>
            issueHook.issueKey(
              vaultAddress,
              agentAddress as Address,
              parseFloat(durationHours),
              maxSingleEth,
              dailyBudgetEth
            )
          }
        >
          {issueHook.isPending
            ? "Signing..."
            : issueHook.isConfirming
              ? "Confirming..."
              : "Issue Session Key"}
        </button>
        {issueHook.isSuccess && (
          <p className="font-mono text-sm text-ink/60">
            Session key issued successfully.
          </p>
        )}
      </div>

      {/* Query / Revoke Session */}
      <div className="space-y-3 border-t border-ink/20 pt-4">
        <h4 className="font-mono text-xs text-terracotta tracking-widest uppercase">
          [ Query / Revoke ]
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={queryAgent}
            onChange={(e) => setQueryAgent(e.target.value)}
            placeholder="Agent address to query (0x...)"
            className="input-field text-sm"
          />
          <button
            className="btn-danger whitespace-nowrap"
            disabled={
              !queryAgent ||
              revokeHook.isPending ||
              revokeHook.isConfirming
            }
            onClick={() =>
              revokeHook.revokeKey(vaultAddress, queryAgent as Address)
            }
          >
            {revokeHook.isPending ? "Signing..." : "Revoke"}
          </button>
        </div>

        {/* Session info display */}
        {queryAgent && sessionInfo.data && (
          <div className="bg-surface border border-ink/20 p-3 space-y-1 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-ink/60">Active:</span>
              <span>
                {sessionActive.data ? (
                  <span className="badge-active">Yes</span>
                ) : (
                  <span className="badge-inactive">No</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Expires:</span>
              <span>
                {(sessionInfo.data as any)?.expiresAt
                  ? new Date(
                      Number((sessionInfo.data as any).expiresAt) * 1000
                    ).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Max Single:</span>
              <span>
                {(sessionInfo.data as any)?.maxSingleAmount
                  ? `${formatEther((sessionInfo.data as any).maxSingleAmount)} ETH`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Daily Budget:</span>
              <span>
                {(sessionInfo.data as any)?.dailyBudget
                  ? `${formatEther((sessionInfo.data as any).dailyBudget)} ETH`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Spent Today:</span>
              <span>
                {(sessionInfo.data as any)?.spentToday
                  ? `${formatEther((sessionInfo.data as any).spentToday)} ETH`
                  : "0 ETH"}
              </span>
            </div>
          </div>
        )}

        {revokeHook.isSuccess && (
          <p className="font-mono text-sm text-ink/60">Session key revoked.</p>
        )}
      </div>
    </div>
  );
}
