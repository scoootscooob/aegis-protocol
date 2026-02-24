"""
Vault-aware configuration loader for the Plimsoll RPC Proxy.

Reads on-chain vault parameters (velocity limits, drawdown, etc.) and
maps them to a ``PlimsollConfig`` for the firewall. Caches configs with
a TTL to avoid hammering the RPC.

Usage::

    from plimsoll.proxy.vault_config import VaultConfigCache

    cache = VaultConfigCache(rpc_url="https://mainnet.base.org")
    config = await cache.get("0x1234...")
    firewall = PlimsollFirewall(config=config)
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from plimsoll.firewall import PlimsollConfig
from plimsoll.engines.capital_velocity import CapitalVelocityConfig

logger = logging.getLogger("plimsoll.proxy.vault_config")

# ── Minimal ABI fragments for on-chain reads ────────────────

# PlimsollVault: velocityModule() → address
_VELOCITY_MODULE_SIG = "0x951be135"
# PlimsollVault: whitelistModule() → address
_WHITELIST_MODULE_SIG = "0x8fea31b0"
# PlimsollVault: drawdownModule() → address
_DRAWDOWN_MODULE_SIG = "0xdd4c17ae"
# PlimsollVault: owner() → address
_OWNER_SIG = "0x8da5cb5b"
# PlimsollVault: emergencyLocked() → bool
_EMERGENCY_LOCKED_SIG = "0xe92fab8d"

# VelocityLimitModule: maxPerHour() → uint256
_MAX_PER_HOUR_SIG = "0x335c9d8c"
# VelocityLimitModule: maxSingleTx() → uint256
_MAX_SINGLE_TX_SIG = "0x0cf96009"

# DrawdownGuardModule: maxDrawdownBps() → uint256
_MAX_DRAWDOWN_BPS_SIG = "0x5661d461"

# TargetWhitelistModule:
# getWhitelistCount() → uint256
_WHITELIST_COUNT_SIG = "0x3edff20f"
# whitelistedList(uint256) → address
_WHITELISTED_LIST_SIG = "0x05c8d3eb"
# whitelisted(address) → bool
_WHITELISTED_SIG = "0xd936547e"

# Maximum whitelist entries to read (prevent abuse)
_MAX_WHITELIST_ENTRIES = 100


@dataclass
class CachedConfig:
    """A cached PlimsollConfig with a TTL."""
    config: PlimsollConfig
    fetched_at: float
    vault_address: str
    owner: str = ""
    emergency_locked: bool = False


@dataclass
class VaultConfigCache:
    """Reads and caches on-chain vault parameters.

    Args:
        rpc_url: Upstream RPC endpoint (Alchemy, Infura, etc.)
        cache_ttl_secs: How long to cache configs (default: 300s = 5 min)
    """

    rpc_url: str
    cache_ttl_secs: float = 300.0
    _cache: dict[str, CachedConfig] = field(default_factory=dict, init=False, repr=False)
    _whitelist_cache: dict[str, frozenset[str]] = field(default_factory=dict, init=False, repr=False)
    _whitelist_fetched_at: dict[str, float] = field(default_factory=dict, init=False, repr=False)

    async def get(self, vault_address: str) -> PlimsollConfig:
        """Get PlimsollConfig for a vault, using cache if fresh."""
        now = time.time()
        cached = self._cache.get(vault_address.lower())

        if cached and (now - cached.fetched_at) < self.cache_ttl_secs:
            return cached.config

        config = await self._fetch_from_chain(vault_address)
        self._cache[vault_address.lower()] = CachedConfig(
            config=config,
            fetched_at=now,
            vault_address=vault_address,
        )
        return config

    async def get_cached_info(self, vault_address: str) -> Optional[CachedConfig]:
        """Get cached info (including owner, lock status) if available."""
        return self._cache.get(vault_address.lower())

    # ── Whitelist Gate ─────────────────────────────────────────

    async def check_whitelist(
        self, vault_address: str, target: str
    ) -> tuple[bool, str]:
        """Check if a destination address is whitelisted for this vault.

        Returns (allowed, reason).

        If the vault has no whitelist module or an empty whitelist,
        returns (True, ...) to allow legacy/unconfigured vaults to work.
        """
        key = vault_address.lower()
        now = time.time()

        # Load whitelist if not cached or stale
        fetched_at = self._whitelist_fetched_at.get(key, 0.0)
        if (now - fetched_at) >= self.cache_ttl_secs:
            await self._fetch_whitelist(vault_address)

        whitelist = self._whitelist_cache.get(key)

        # Empty whitelist = legacy mode — don't block
        if not whitelist:
            return (True, "No whitelist configured — legacy mode")

        target_lower = target.lower()
        if target_lower in whitelist:
            return (True, f"Target {target[:10]}... is whitelisted")

        return (
            False,
            f"WHITELIST GATE: Target {target} is not on the vault's "
            f"approved whitelist ({len(whitelist)} entries). "
            f"Add it via the Plimsoll dashboard.",
        )

    async def _fetch_whitelist(self, vault_address: str) -> None:
        """Read the vault's whitelist module entries from the chain."""
        key = vault_address.lower()
        self._whitelist_fetched_at[key] = time.time()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Step 1: Read whitelistModule address from vault
                wl_module_raw = await self._eth_call(
                    client, vault_address, _WHITELIST_MODULE_SIG
                )
                if not wl_module_raw or wl_module_raw == "0" * 40:
                    self._whitelist_cache[key] = frozenset()
                    return

                wl_module_addr = "0x" + wl_module_raw[-40:]

                # Step 2: Read getWhitelistCount()
                count_raw = await self._eth_call(
                    client, wl_module_addr, _WHITELIST_COUNT_SIG
                )
                if not count_raw:
                    self._whitelist_cache[key] = frozenset()
                    return

                count = int(count_raw, 16)
                if count == 0:
                    self._whitelist_cache[key] = frozenset()
                    return

                # Cap to prevent abuse
                count = min(count, _MAX_WHITELIST_ENTRIES)

                # Step 3: Read each whitelistedList(i) entry
                addresses: set[str] = set()
                for i in range(count):
                    # Encode whitelistedList(uint256 i) — selector + abi-encoded uint256
                    index_hex = hex(i)[2:].zfill(64)
                    data = _WHITELISTED_LIST_SIG + index_hex
                    addr_raw = await self._eth_call(client, wl_module_addr, data)
                    if addr_raw:
                        addr = "0x" + addr_raw[-40:].lower()
                        # Step 4: Verify via whitelisted(address) mapping
                        # (removeTarget sets mapping to false but doesn't remove from array)
                        addr_padded = addr[2:].lower().zfill(64)
                        verify_data = _WHITELISTED_SIG + addr_padded
                        is_active = await self._eth_call(
                            client, wl_module_addr, verify_data
                        )
                        if is_active and int(is_active, 16) == 1:
                            addresses.add(addr)

                self._whitelist_cache[key] = frozenset(addresses)
                logger.info(
                    "Loaded whitelist for vault %s: %d active entries",
                    vault_address[:10], len(addresses),
                )

        except Exception as exc:
            logger.warning(
                "Failed to fetch whitelist for %s: %s", vault_address[:10], exc
            )
            # Don't block on failure — keep existing cache or empty
            if key not in self._whitelist_cache:
                self._whitelist_cache[key] = frozenset()

    async def _fetch_from_chain(self, vault_address: str) -> PlimsollConfig:
        """Read vault parameters from the blockchain."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Read module addresses from vault
                velocity_module = await self._eth_call(
                    client, vault_address, _VELOCITY_MODULE_SIG
                )
                drawdown_module = await self._eth_call(
                    client, vault_address, _DRAWDOWN_MODULE_SIG
                )

                # Read velocity params
                max_per_hour_wei = 0
                max_single_tx_wei = 0
                max_drawdown_bps = 500  # default 5%

                if velocity_module and velocity_module != "0" * 40:
                    addr = "0x" + velocity_module[-40:]
                    raw = await self._eth_call(client, addr, _MAX_PER_HOUR_SIG)
                    if raw:
                        max_per_hour_wei = int(raw, 16) if raw else 0
                    raw = await self._eth_call(client, addr, _MAX_SINGLE_TX_SIG)
                    if raw:
                        max_single_tx_wei = int(raw, 16) if raw else 0

                if drawdown_module and drawdown_module != "0" * 40:
                    addr = "0x" + drawdown_module[-40:]
                    raw = await self._eth_call(client, addr, _MAX_DRAWDOWN_BPS_SIG)
                    if raw:
                        max_drawdown_bps = int(raw, 16) if raw else 500

                # Convert wei to ETH for velocity config
                max_per_hour_eth = max_per_hour_wei / 1e18 if max_per_hour_wei else 5.0
                max_single_tx_eth = max_single_tx_wei / 1e18 if max_single_tx_wei else 2.0

                # v_max = max spend per second (from hourly rate)
                v_max = max_per_hour_eth / 3600.0

                logger.info(
                    "Loaded vault config for %s: v_max=%.6f/s, max_single=%.2f ETH, drawdown=%d bps",
                    vault_address, v_max, max_single_tx_eth, max_drawdown_bps,
                )

                return PlimsollConfig(
                    velocity=CapitalVelocityConfig(
                        v_max=v_max,
                        max_single_amount=max_single_tx_eth,
                        window_seconds=300.0,
                    ),
                )

        except Exception as exc:
            logger.warning(
                "Failed to read vault config for %s, using defaults: %s",
                vault_address, exc,
            )
            return PlimsollConfig()

    async def _eth_call(
        self, client: httpx.AsyncClient, to: str, data: str
    ) -> Optional[str]:
        """Execute a read-only eth_call."""
        try:
            resp = await client.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_call",
                    "params": [{"to": to, "data": data}, "latest"],
                    "id": 1,
                },
            )
            result = resp.json()
            if "result" in result and result["result"] != "0x":
                return result["result"].replace("0x", "")
            return None
        except Exception as exc:
            logger.debug("eth_call to %s failed: %s", to, exc)
            return None
