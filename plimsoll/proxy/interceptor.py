"""
Interceptor Proxy — The Choke Point.

A lightweight ASGI proxy (Starlette) that sits between agents and the
blockchain. Agents point their RPC URL at Plimsoll instead of directly
at Alchemy/Infura.

Three modes:

1. **Global** (``POST /``): All traffic filtered through a single firewall
   with default config. Good for single-agent setups.

2. **Vault-aware** (``POST /v1/{vault_address}``): Each vault gets its own
   firewall configured from on-chain parameters. The agent just changes its
   RPC URL and gets protection — zero code changes.

3. **API** (``GET /api/*``): Dashboard endpoints for live monitoring.

Deploy as::

    uvicorn plimsoll.proxy.interceptor:app --host 0.0.0.0 --port 8545

Compatible with any agent framework (LangChain, Eliza, OpenClaw, AgentKit,
Automaton, etc.) that can be configured to point at a custom RPC endpoint.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from plimsoll.firewall import PlimsollFirewall, PlimsollConfig
from plimsoll.engines.threat_feed import ThreatFeedConfig
from plimsoll.engines.capital_velocity import CapitalVelocityConfig
from plimsoll.engines.payload_quantizer import PayloadQuantizerConfig
from plimsoll.engines.evm_simulator import EVMSimulatorConfig
from plimsoll.proxy.vault_config import VaultConfigCache
from plimsoll.proxy.threat_seed import seed_threat_feed

logger = logging.getLogger("plimsoll.proxy")

# ── Module-level state ───────────────────────────────────────

_firewall: PlimsollFirewall | None = None
_upstream_url: str = ""
_vault_cache: VaultConfigCache | None = None
_boot_time: float = 0.0

# Per-vault firewall instances (lazy-created, keyed by vault address)
_vault_firewalls: dict[str, PlimsollFirewall] = {}


# ── Full Production Config ────────────────────────────────────

def _production_config() -> PlimsollConfig:
    """Build the fully-activated Plimsoll config.

    Enables all features that don't require external services:
    - Engine 0: ThreatFeed (seeded with curated blacklist)
    - Engine 2: GTV ratio caps (paymaster parasite defense)
    - Engine 5: Payload Quantizer (steganography destruction)
    - Engine 6: EVM Simulator (fail-open, blocked_contracts + approval friction)
    - Cognitive Sever: Auto-lockout after 5 blocks in 10 min
    - Paymaster Slashing: Auto-revoke after 10 reverts in 5 min
    - Gas Anomaly Detection: Alert if actual > 3x simulated
    - PVG Ceiling: Max preVerificationGas 500,000
    - Chain ID: Base = 8453
    """
    return PlimsollConfig(
        # Engine 0: Threat Feed — seeded on startup
        threat_feed=ThreatFeedConfig(enabled=True),

        # Engine 2: Capital Velocity + GTV Ratio
        velocity=CapitalVelocityConfig(
            v_max=100.0,
            window_seconds=300.0,
            max_single_amount=50.0,
            gtv_enabled=True,
            gtv_max_ratio=5.0,
            gtv_min_value=0.001,
            gtv_window_seconds=300.0,
            gtv_cumulative_max=10.0,
        ),

        # Engine 5: Payload Quantizer (steganography destruction)
        quantizer=PayloadQuantizerConfig(enabled=True),

        # Engine 6: EVM Simulator (fail-open — allows when no simulator present)
        simulator=EVMSimulatorConfig(enabled=True, fail_closed=False),

        # Cognitive Sever: 5 strikes in 10 min → 15 min lockout
        cognitive_sever_enabled=True,
        strike_max=5,
        strike_window_secs=600.0,
        sever_duration_secs=900.0,

        # Paymaster Slashing: 10 reverts in 5 min → permanent sever
        revert_strike_max=10,
        revert_strike_window_secs=300.0,

        # Gas Anomaly: actual > 3x simulated → strike
        gas_anomaly_ratio=3.0,

        # PVG Ceiling (ERC-4337)
        max_pre_verification_gas=500_000,

        # Chain ID: Base = 8453
        chain_id=8453,
    )


# ── Helpers ──────────────────────────────────────────────────

def _normalize_payload(body: dict[str, Any]) -> dict[str, Any]:
    """Convert a JSON-RPC envelope to the flat dict that all 7 engines expect.

    Engines were designed for::

        {"target": "0x...", "amount": 1.5, "function": "0xa9059cbb", "data": "0x..."}

    But the proxy receives raw JSON-RPC::

        {"method": "eth_sendTransaction", "params": [{"to": "0x...", "value": "0x...", "data": "0x..."}]}

    This normalizer bridges the gap so that ThreatFeed, TrajectoryHash,
    AssetGuard, PayloadQuantizer, and EVMSimulator all receive the fields
    they need.
    """
    params: dict[str, Any] = {}
    if "params" in body and isinstance(body["params"], list):
        for p in body["params"]:
            if isinstance(p, dict):
                params = p
                break

    to = params.get("to", "")
    data = params.get("data", "") or params.get("input", "")
    value = params.get("value", "0x0")

    # Decode value from hex wei to float ETH
    amount = 0.0
    if isinstance(value, str) and value.startswith("0x"):
        try:
            amount = int(value, 16) / 1e18
        except ValueError:
            pass
    elif value:
        try:
            amount = float(value)
        except (ValueError, TypeError):
            pass

    # Extract function selector (first 4 bytes of calldata)
    selector = ""
    if isinstance(data, str) and len(data) >= 10:
        selector = data[:10].lower()

    return {
        # Fields engines expect:
        "target": to.lower() if to else "",
        "amount": amount,
        "function": selector,
        "data": data,
        "from": params.get("from", ""),
        "value": value,
        "gas": params.get("gas", ""),
        "gasPrice": params.get("gasPrice", ""),
        "maxFeePerGas": params.get("maxFeePerGas", ""),
        # Preserve original for forwarding
        "_raw_jsonrpc": body,
        "_method": body.get("method", ""),
    }


def _extract_spend(body: dict[str, Any]) -> float:
    """Extract spend amount from a JSON-RPC payload (heuristic)."""
    spend = 0.0

    # Direct value field
    if "value" in body:
        try:
            val = body["value"]
            # Handle hex-encoded wei (e.g., "0x2386f26fc10000")
            if isinstance(val, str) and val.startswith("0x"):
                spend = int(val, 16) / 1e18
            else:
                spend = float(val)
        except (ValueError, TypeError):
            pass
    # JSON-RPC params array (eth_sendTransaction)
    elif "params" in body and isinstance(body["params"], list):
        for param in body["params"]:
            if isinstance(param, dict) and "value" in param:
                try:
                    val = param["value"]
                    if isinstance(val, str) and val.startswith("0x"):
                        spend = int(val, 16) / 1e18
                    else:
                        spend = float(val)
                except (ValueError, TypeError):
                    pass
                break

    return spend


def _is_read_only(body: dict[str, Any]) -> bool:
    """Check if a JSON-RPC request is read-only (no state change)."""
    method = body.get("method", "")
    write_methods = {
        "eth_sendTransaction",
        "eth_sendRawTransaction",
        "eth_sign",
        "personal_sign",
        "eth_signTypedData",
        "eth_signTypedData_v3",
        "eth_signTypedData_v4",
    }
    return method not in write_methods


async def _forward_upstream(body: dict[str, Any]) -> JSONResponse:
    """Forward a request to the upstream RPC."""
    async with httpx.AsyncClient() as client:
        upstream_resp = await client.post(
            _upstream_url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )
    return JSONResponse(upstream_resp.json(), status_code=upstream_resp.status_code)


def _block_response(verdict: Any) -> JSONResponse:
    """Return a JSON 403 block response."""
    return JSONResponse(
        {
            "plimsoll_blocked": True,
            "verdict": verdict.code.value,
            "reason": verdict.reason,
            "feedback": verdict.feedback_prompt(),
        },
        status_code=403,
    )


def _whitelist_block_response(destination: str, reason: str) -> JSONResponse:
    """Return a JSON 403 block response for whitelist rejection."""
    return JSONResponse(
        {
            "plimsoll_blocked": True,
            "verdict": "BLOCK_WHITELIST",
            "reason": reason,
            "feedback": (
                f"Destination {destination} is not on the vault's whitelist. "
                f"The vault owner must add it via the Plimsoll dashboard."
            ),
        },
        status_code=403,
    )


def _seed_firewall(firewall: PlimsollFirewall) -> None:
    """Seed a firewall's Engine 0 with curated threat data."""
    seed_threat_feed(firewall.threat_feed)
    logger.info(
        "Seeded Engine 0: %d entries (%d addresses, %d selectors, %d hashes)",
        firewall.threat_feed.size,
        len(firewall.threat_feed._addresses),
        len(firewall.threat_feed._selectors),
        len(firewall.threat_feed._calldata_hashes),
    )


# ── Route Handlers ───────────────────────────────────────────

async def _handle_rpc(request: Request) -> JSONResponse:
    """Global RPC handler — single firewall for all traffic."""
    assert _firewall is not None

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON payload"}, status_code=400)

    # Read-only calls pass through without evaluation
    if _is_read_only(body):
        return await _forward_upstream(body)

    # Normalize JSON-RPC → flat dict for all 7 engines
    normalized = _normalize_payload(body)
    spend = normalized["amount"]

    verdict = _firewall.evaluate(normalized, spend_amount=spend)

    if verdict.blocked:
        logger.warning("PROXY BLOCK: %s", verdict.reason)
        return _block_response(verdict)

    return await _forward_upstream(body)


async def _handle_vault_rpc(request: Request) -> JSONResponse:
    """Vault-aware RPC handler — per-vault firewall from on-chain config.

    URL: POST /v1/{vault_address}

    The agent just points its RPC URL to:
        https://rpc.plimsoll.network/v1/0xYourVaultAddress

    The proxy reads the vault's on-chain parameters and configures a
    firewall instance automatically. Zero code changes on the agent side.

    Pipeline::

        Read-only? → pass through
        Normalize JSON-RPC → flat tx dict
        Whitelist Gate → BLOCK if destination not whitelisted
        7-Engine Firewall → BLOCK if any engine triggers
        Forward to upstream RPC
    """
    vault_address = request.path_params.get("vault_address", "")

    if not vault_address or not vault_address.startswith("0x") or len(vault_address) != 42:
        return JSONResponse(
            {"error": "Invalid vault address. Use /v1/0x..."},
            status_code=400,
        )

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON payload"}, status_code=400)

    # Read-only calls pass through without evaluation
    if _is_read_only(body):
        return await _forward_upstream(body)

    # ── Step 1: Normalize JSON-RPC → flat dict for all 7 engines ──
    normalized = _normalize_payload(body)
    destination = normalized["target"]
    spend = normalized["amount"]

    # ── Step 2: Whitelist Gate (fast fail) ────────────────────────
    # If the vault has a whitelist configured, check destination first.
    # Empty whitelist = legacy mode (falls through to firewall only).
    if destination and _vault_cache:
        allowed, reason = await _vault_cache.check_whitelist(vault_address, destination)
        if not allowed:
            logger.warning(
                "WHITELIST BLOCK [%s]: %s → %s",
                vault_address[:10], destination[:10], reason,
            )
            return _whitelist_block_response(destination, reason)

    # ── Step 3: 7-Engine Firewall Evaluation ─────────────────────
    firewall = await _get_vault_firewall(vault_address)
    verdict = firewall.evaluate(normalized, spend_amount=spend)

    if verdict.blocked:
        logger.warning("VAULT PROXY BLOCK [%s]: %s", vault_address[:10], verdict.reason)
        return _block_response(verdict)

    return await _forward_upstream(body)


async def _get_vault_firewall(vault_address: str) -> PlimsollFirewall:
    """Get or create a firewall instance for a specific vault."""
    key = vault_address.lower()

    if key in _vault_firewalls:
        # Check if we should refresh config (piggyback on VaultConfigCache TTL)
        return _vault_firewalls[key]

    # Load config from chain
    if _vault_cache:
        config = await _vault_cache.get(vault_address)
    else:
        config = _production_config()

    # Enable production features on per-vault firewalls too
    config.threat_feed.enabled = True
    config.cognitive_sever_enabled = True
    config.strike_max = 5
    config.strike_window_secs = 600.0
    config.revert_strike_max = 10
    config.gas_anomaly_ratio = 3.0
    config.max_pre_verification_gas = 500_000
    config.chain_id = 8453

    firewall = PlimsollFirewall(config=config)

    # Seed Engine 0 for this vault's firewall too
    _seed_firewall(firewall)

    _vault_firewalls[key] = firewall
    logger.info("Created firewall for vault %s (all engines active)", vault_address[:10])

    return firewall


# ── Health / API Endpoints ───────────────────────────────────

async def _health(request: Request) -> JSONResponse:
    """Health check endpoint."""
    stats: dict[str, Any] = {}
    if _firewall:
        stats["global"] = _firewall.stats
    stats["vaults_active"] = len(_vault_firewalls)
    stats["cache_entries"] = len(_vault_cache._cache) if _vault_cache else 0

    # Include per-vault whitelist stats
    if _vault_cache:
        vault_details: dict[str, Any] = {}
        for addr, cached in _vault_cache._cache.items():
            whitelist = _vault_cache._whitelist_cache.get(addr)
            vault_details[addr[:10] + "..."] = {
                "whitelist_entries": len(whitelist) if whitelist else 0,
                "emergency_locked": cached.emergency_locked,
            }
        if vault_details:
            stats["vaults"] = vault_details

    return JSONResponse({
        "status": "ok",
        "upstream": _upstream_url,
        "engines": 7,
        "protection": "normalizer + whitelist_gate + 7_engine_firewall",
        "uptime_secs": round(time.time() - _boot_time, 1) if _boot_time else 0,
        "stats": stats,
    })


async def _api_threat_feed(request: Request) -> JSONResponse:
    """GET /api/threat-feed — Threat feed stats + recent blocks.

    Returns Engine 0 status, blacklist counts, immune protocol count,
    and recent block events from the global firewall.
    """
    if not _firewall:
        return JSONResponse({"error": "Firewall not initialized"}, status_code=503)

    tf = _firewall.threat_feed
    recent = _firewall.recent_blocks if hasattr(_firewall, "recent_blocks") else []

    return JSONResponse({
        "enabled": tf.config.enabled,
        "stats": tf.stats,
        "immune_protocols": len(tf._addresses & set()) + 9,  # 9 built-in
        "recent_blocks": list(recent),
        "uptime_secs": round(time.time() - _boot_time, 1) if _boot_time else 0,
    })


async def _api_engines(request: Request) -> JSONResponse:
    """GET /api/engines — All 7 engine statuses + active features.

    Returns per-engine info (name, ID, enabled, block count) and
    a summary of all enabled defense features.
    """
    if not _firewall:
        return JSONResponse({"error": "Firewall not initialized"}, status_code=503)

    cfg = _firewall.config
    engine_stats = _firewall.engine_stats if hasattr(_firewall, "engine_stats") else []

    # Build engine list
    engines = [
        {
            "name": "ThreatFeed",
            "id": 0,
            "enabled": cfg.threat_feed.enabled,
            "entries": _firewall.threat_feed.size,
            "blocks": _firewall.threat_feed._block_count,
        },
        {
            "name": "TrajectoryHash",
            "id": 1,
            "enabled": True,  # Always enabled
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "TrajectoryHash"), 0),
        },
        {
            "name": "CapitalVelocity",
            "id": 2,
            "enabled": True,  # Always enabled
            "gtv_enabled": cfg.velocity.gtv_enabled,
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "CapitalVelocity"), 0),
        },
        {
            "name": "EntropyGuard",
            "id": 3,
            "enabled": True,  # Always enabled
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "EntropyGuard"), 0),
        },
        {
            "name": "AssetGuard",
            "id": 4,
            "enabled": True,  # Always enabled
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "AssetGuard"), 0),
        },
        {
            "name": "PayloadQuantizer",
            "id": 5,
            "enabled": cfg.quantizer.enabled,
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "PayloadQuantizer"), 0),
        },
        {
            "name": "EVMSimulator",
            "id": 6,
            "enabled": cfg.simulator.enabled,
            "fail_closed": cfg.simulator.fail_closed,
            "blocks": next((e.get("blocks", 0) for e in engine_stats if e.get("name") == "EVMSimulator"), 0),
        },
    ]

    features = {
        "cognitive_sever": cfg.cognitive_sever_enabled,
        "cognitive_sever_config": (
            f"{cfg.strike_max} strikes / {int(cfg.strike_window_secs)}s window"
            if cfg.cognitive_sever_enabled else "disabled"
        ),
        "paymaster_defense": cfg.revert_strike_max > 0,
        "paymaster_config": (
            f"{cfg.revert_strike_max} reverts / {int(cfg.revert_strike_window_secs)}s window"
            if cfg.revert_strike_max > 0 else "disabled"
        ),
        "gtv_ratio": cfg.velocity.gtv_enabled,
        "gtv_max_ratio": cfg.velocity.gtv_max_ratio,
        "gas_anomaly": cfg.gas_anomaly_ratio > 0,
        "gas_anomaly_ratio": cfg.gas_anomaly_ratio,
        "pvg_ceiling": cfg.max_pre_verification_gas > 0,
        "pvg_max": cfg.max_pre_verification_gas,
        "chain_id": cfg.chain_id,
        "whitelist_gate": True,
    }

    return JSONResponse({
        "engines": engines,
        "features": features,
        "total_evaluations": _firewall.stats.get("total", 0),
        "total_blocks": _firewall.stats.get("blocked", 0),
        "engine_block_counts": engine_stats,
        "recent_blocks": list(
            _firewall.recent_blocks if hasattr(_firewall, "recent_blocks") else []
        ),
        "uptime_secs": round(time.time() - _boot_time, 1) if _boot_time else 0,
    })


# ── App Factory ──────────────────────────────────────────────

def create_proxy_app(
    upstream_url: str,
    config: PlimsollConfig | None = None,
) -> Starlette:
    """Create a configured Starlette ASGI app acting as the Plimsoll proxy.

    The app serves three route families:

    - ``POST /`` — Global firewall (backward compatible)
    - ``POST /v1/{vault_address}`` — Per-vault firewall from on-chain config
    - ``GET /health`` — Health check
    - ``GET /api/threat-feed`` — Threat feed dashboard data
    - ``GET /api/engines`` — All 7 engine statuses
    """
    global _firewall, _upstream_url, _vault_cache, _boot_time

    _upstream_url = upstream_url
    _boot_time = time.time()

    # Use production config with all features enabled
    active_config = config or _production_config()
    _firewall = PlimsollFirewall(config=active_config)

    # Seed Engine 0 with curated blacklist data
    _seed_firewall(_firewall)

    _vault_cache = VaultConfigCache(rpc_url=upstream_url)

    logger.info(
        "Plimsoll proxy started — all engines active, %d threat entries seeded",
        _firewall.threat_feed.size,
    )

    app = Starlette(
        routes=[
            Route("/", _handle_rpc, methods=["POST"]),
            Route("/v1/{vault_address}", _handle_vault_rpc, methods=["POST"]),
            Route("/health", _health, methods=["GET"]),
            Route("/api/threat-feed", _api_threat_feed, methods=["GET"]),
            Route("/api/engines", _api_engines, methods=["GET"]),
        ],
    )

    # Add CORS middleware for dashboard access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    return app


# Default app for `uvicorn plimsoll.proxy.interceptor:app`
_default_upstream = os.environ.get(
    "PLIMSOLL_UPSTREAM_RPC",
    "https://mainnet.base.org",
)
app = create_proxy_app(upstream_url=_default_upstream)
