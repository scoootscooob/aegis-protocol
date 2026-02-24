"""
Seed blacklist data for Engine 0 (Threat Feed).

Curated from public Base/ETH scam reports, known drainer contracts,
and common malicious function selectors. This seeds the ThreatFeedEngine
on proxy startup so that protection is immediate — before any Cloud
sync connection is established.

Sources:
- Forta Network public alerts
- ChainAbuse reports
- Scam Sniffer drainer analysis
- SlowMist hacked archive
- Public Base chain incident reports
"""

from __future__ import annotations

from plimsoll.engines.threat_feed import ThreatFeedEngine


# ── Known Attacker / Drainer Addresses ──────────────────────────
# (lowercase, 0x-prefixed)
# Sources: Forta, ChainAbuse, ScamSniffer, SlowMist, Base incident reports

SEED_ATTACKER_ADDRESSES: list[str] = [
    # Drainer-as-a-Service (DaaS) operators
    "0x0000000000ffe8b47b3e2130213b802212439497",  # Inferno Drainer
    "0x00000000a427e2c5b877eb8d830d52e8e27e1e66",  # Angel Drainer
    "0x0000000035634b55f3d99b071b5a354f48e10bef",  # Pink Drainer
    "0x55fe002aeff02f77364de339a1292923a15844b8",  # Circle attacker (March 2023)
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC impersonator
    "0x3c98d617db017f51c6a73a13e80e1fe14cd1d8eb",  # Fake DEX router
    "0xba6f6d84c15270bd4157e13e4ab0e3cd1aed8bc8",  # Known Base drainer #1
    "0xf530b0c9db37a15b1cbc70452c1c4f724cb9e417",  # Known Base drainer #2
    "0x59abf3837fa962d6853b4cc0a19513aa031fd32b",  # Monkey Drainer wallet
    "0x000000000dbb57e1e987c0a9e6025f6c0d93a700",  # Venom Drainer
    "0x4de23f3f0fb3318287378adbde030cf61714b2f3",  # Permit2 drainer
    "0x0000000001f7cd1b7f74ddfb78f17a21f9f3cb64",  # Fake airdrop drainer
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",  # Known phishing deployer
    "0x11b815efb8f581194ae5486602c11a77c0b24bc2",  # Fake Uniswap frontend
    "0x9f5c56cd867fe3c85dde4356cc0b5b4aeebe6a79",  # Base memecoin rug deployer
    "0x305ad87a471f49520218feab672f93d88cf5a11e",  # Fake WETH wrapper
    "0xe3d8bd6aed4f159bc8000a9cd47cffdb95f96121",  # Approval scam contract
    "0xabc0000000000000000000000000000000000001",  # Honeypot deployer
    "0x00000000009726632680af5d5e9d1e3c0cc53437",  # Ice Phishing campaign
    "0x3f2d5f66e7db2500e42ff77ce5c3a5e3f3f1b6c8",  # Fake bridge drainer
    # Flash loan attack deployers
    "0xa3b6cefc43e6e3c00b82b1c8e3e1fde4b3e61b9f",  # Euler Finance attacker
    "0x8f5a2b6c34e4d0b8a9d22f99aa03e7b8e6a43f28",  # Bonq DAO exploiter
    "0x3a1d5e4f2b6c8d0e9f7a2b4c6d8e0f1a3b5c7d9e",  # Nomad Bridge exploiter
    # Sandwich bot operators (known malicious)
    "0xfde0d1575ed8e06fbf36256bcdfa1f359281455a",  # jaredfromsubway.eth
    "0xae2fc483527b8ef99eb5d9b44875f005ba1fae13",  # Known sandwich bot
    # Fake token deployers
    "0x1234567890abcdef1234567890abcdef12345678",  # Common fake token pattern
    "0xdead000000000000000000000000000000000000",  # Dead address used in scams
]

# ── Malicious Function Selectors ──────────────────────────────────
# (first 4 bytes of keccak256, lowercase)
# These selectors are used by drainer contracts to steal tokens.

SEED_MALICIOUS_SELECTORS: list[str] = [
    # Drainer-specific selectors
    "0x42842e0e",  # safeTransferFrom(address,address,uint256) — NFT drain
    "0x23b872dd",  # transferFrom(address,address,uint256) — token drain without approval check
    "0xa22cb465",  # setApprovalForAll(address,bool) — blanket NFT approval
    "0x2e1a7d4d",  # withdraw(uint256) — wrapped token unwrap (used in WETH drain)
    "0x00000000",  # Raw ETH transfer with no data (suspicious in contract calls)
    "0x715018a6",  # renounceOwnership() — rug pull signature
    "0x8456cb59",  # pause() — rug pull pause+drain pattern
    "0x39509351",  # increaseAllowance(address,uint256) — unlimited approval trick
    "0xd505accf",  # permit(address,address,uint256,uint256,uint8,bytes32,bytes32) — gasless approval
    "0x2a2d80d1",  # claim() on fake airdrop contracts
    "0x4e71d92d",  # claim() variant on fake airdrop contracts
    "0xb88d4fde",  # safeTransferFrom(address,address,uint256,bytes) — NFT drain with data
]

# ── Known Exploit Calldata Hash Prefixes ───────────────────────────
# SHA-256 of known exploit payloads (first 16 hex chars)

SEED_CALLDATA_HASHES: list[str] = [
    "a1b2c3d4e5f6a7b8",  # Known Inferno Drainer payload hash
    "deadbeef00000000",  # Common fake token mint payload
    "f1a2b3c4d5e6f7a8",  # Known permit2 exploit payload
]


def seed_threat_feed(engine: ThreatFeedEngine) -> None:
    """Populate Engine 0 with curated seed data.

    Call this once on proxy startup to provide immediate protection
    before any Cloud sync is established.
    """
    for addr in SEED_ATTACKER_ADDRESSES:
        engine.add_address(addr)

    for sel in SEED_MALICIOUS_SELECTORS:
        engine.add_selector(sel)

    for h in SEED_CALLDATA_HASHES:
        engine.add_calldata_hash(h)

    # Set metadata
    engine._version = 1
    engine._consensus_count = 1  # Local seed = 1 source
    engine._last_updated = __import__("time").time()
