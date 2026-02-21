"use client";

/**
 * Custom hooks for interacting with the PlimsollVaultFactory contract.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, type Address } from "viem";
import { PLIMSOLL_FACTORY_ABI, PLIMSOLL_VAULT_ABI, CONTRACTS } from "@/lib/contracts";

const FACTORY_ADDRESS = CONTRACTS.sepolia.factory as Address;

// ── Write: createVault ──────────────────────────────────────

export function useCreateVault() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createVault = (
    maxPerHourEth: string,
    maxSingleTxEth: string,
    maxDrawdownBps: number,
    depositEth?: string
  ) => {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: PLIMSOLL_FACTORY_ABI,
      functionName: "createVault",
      args: [
        parseEther(maxPerHourEth),
        parseEther(maxSingleTxEth),
        BigInt(maxDrawdownBps),
      ],
      value: depositEth ? parseEther(depositEth) : BigInt(0),
    });
  };

  return { createVault, hash, isPending, isConfirming, isSuccess, error };
}

// ── Write: acceptOwnership (second step after factory deploy) ──

export function useAcceptOwnership() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const accept = (vaultAddress: Address) => {
    writeContract({
      address: vaultAddress,
      abi: PLIMSOLL_VAULT_ABI,
      functionName: "acceptOwnership",
    });
  };

  return { accept, hash, isPending, isConfirming, isSuccess, error };
}

// ── Read: getVaultsByOwner ──────────────────────────────────

export function useOwnerVaults(ownerAddress: Address | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: PLIMSOLL_FACTORY_ABI,
    functionName: "getVaultsByOwner",
    args: ownerAddress ? [ownerAddress] : undefined,
    query: {
      enabled: !!ownerAddress,
    },
  });
}

// ── Read: getVaultCount ─────────────────────────────────────

export function useVaultCount() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: PLIMSOLL_FACTORY_ABI,
    functionName: "getVaultCount",
  });
}
