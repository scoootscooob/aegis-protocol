<p align="center">
  <img src="https://img.shields.io/badge/PLIMSOLL-Circuit%20Breaker%20for%20AI%20Agents-000000?style=for-the-badge&labelColor=FF4500" alt="Plimsoll Protocol" height="40"/>
</p>

<h1 align="center">Plimsoll Protocol</h1>

<p align="center">
  <strong>The financial seatbelt for the machine economy.</strong><br/>
  Deterministic circuit breaker that sits between your AI agent's brain and its wallet.
</p>

<p align="center">
  <a href="https://github.com/scoootscooob/plimsoll-protocol/actions"><img src="https://img.shields.io/github/actions/workflow/status/scoootscooob/plimsoll-protocol/ci.yml?style=flat-square&label=836%20tests" alt="Tests"/></a>
  <a href="https://pypi.org/project/plimsoll-protocol/"><img src="https://img.shields.io/badge/pypi-v2.0.0-blue?style=flat-square" alt="PyPI"/></a>
  <a href="https://github.com/scoootscooob/plimsoll-protocol/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"/></a>
  <a href="#"><img src="https://img.shields.io/badge/python-3.9+-yellow?style=flat-square" alt="Python 3.9+"/></a>
  <a href="#"><img src="https://img.shields.io/badge/rust-2021-orange?style=flat-square" alt="Rust"/></a>
  <a href="#"><img src="https://img.shields.io/badge/solidity-0.8.24-363636?style=flat-square" alt="Solidity"/></a>
</p>

<br/>

<p align="center">
  <code>pip install plimsoll-protocol</code>
</p>

<br/>

---

## The Problem

Autonomous AI agents are getting wallets. They're executing trades, bridging assets, signing permits, and calling smart contracts — **without human oversight on every action**.

One hallucinated function call. One prompt injection. One retry loop. That's all it takes to drain a vault.

**Plimsoll is the kill switch that fires before the damage happens.**

---

## How It Works

Plimsoll intercepts every outgoing action between your agent's *Reason* step and its *Act* step. Seven deterministic math engines evaluate the payload in <1ms. If any engine returns **BLOCK**, the transaction is dropped and synthetic cognitive feedback is injected back into the LLM context window — the agent pivots strategy instead of crashing.

```
┌──────────────┐     ┌────────────────────────────────────────┐     ┌──────────┐
│              │     │           PLIMSOLL FIREWALL             │     │          │
│   LLM Agent  │────▶│                                        │────▶│  Chain / │
│   (Reason)   │     │  Threat Feed ─▶ Trajectory Hash        │     │   API    │
│              │◀────│  ─▶ Capital Velocity ─▶ Entropy Guard   │     │  (Act)   │
│  ◀─feedback  │     │  ─▶ Asset Guard ─▶ Payload Quantizer   │     │          │
│              │     │  ─▶ EVM Simulator                      │     │          │
└──────────────┘     └────────────────────────────────────────┘     └──────────┘
                            ▲                        │
                            │     Context-Window     │
                            │       Airgap           │
                            │                        ▼
                      ┌─────────────┐        ┌──────────────┐
                      │  Key Vault  │        │  On-Chain     │
                      │  (Enclave)  │        │  Vault + PoBR │
                      └─────────────┘        └──────────────┘
```

The private key **never touches the LLM context window**. The vault enforces firewall approval *before* decrypting.

---

## Quickstart

### 3 lines to protect any agent

```python
from plimsoll import PlimsollFirewall

firewall = PlimsollFirewall()

verdict = firewall.evaluate(
    payload={"target": "0xDEAD...", "amount": 500, "function": "transfer"},
    spend_amount=500.0
)

if verdict.blocked:
    print(verdict.feedback_prompt())  # inject this back into LLM context
```

### Drop-in decorator

```python
from plimsoll import PlimsollFirewall, with_plimsoll_firewall

firewall = PlimsollFirewall()

@with_plimsoll_firewall(firewall)
def send_payment(target: str, amount: float):
    return wallet.transfer(target, amount)

# Blocked calls return feedback instead of executing
result = send_payment(target="0xHACKER", amount=99999)
```

### Full vault integration (LLM never sees the key)

```python
from plimsoll import PlimsollFirewall, KeyVault

vault = KeyVault()
vault.store("agent-hot-wallet", my_private_key)
vault.bind_firewall(PlimsollFirewall())

# Firewall evaluates BEFORE the key is ever decrypted
signed_tx = vault.sign_eth_transaction(
    key_id="agent-hot-wallet",
    tx_dict={"to": recipient, "value": amount, "gas": 21000},
    spend_amount=1.5
)
```

---

## The Seven Engines

Every payload passes through all seven engines in order. First block wins.

| # | Engine | What It Catches | How |
|---|--------|----------------|-----|
| 0 | **Threat Feed** | Known malicious addresses, selectors, calldata | Bloom filter blacklist with Sybil-resistant crowd-sourced IOCs. O(1), sub-ms. |
| 1 | **Trajectory Hash** | Retry loops, hallucination spirals | SHA-256 of canonical params in a sliding temporal window. 3 dupes in 60s = block. |
| 2 | **Capital Velocity** | Wallet drain, rapid spend-down | PID controller (P + I + D) with algorithmic jitter. Attacker can't model the threshold. |
| 3 | **Entropy Guard** | Private key exfiltration, secret leakage | Shannon entropy + regex for ETH keys, Solana keys, BIP-39 mnemonics, base64 blobs. |
| 4 | **Asset Guard** | Bad swaps, stale intents, bridge hijacks | Token allow-list, oracle liquidity check, slippage cap, 24s intent TTL, bridge destination validation. |
| 5 | **Payload Quantizer** | Steganographic data channels | Snaps numeric values to tick grid, destroying covert channels in amount fields. |
| 6 | **EVM Simulator** | Rug pulls, approval exploits, revert traps | Pre-execution simulation (Tenderly/Anvil/Alchemy), net worth loss cap, approval change detection. |

---

## What It Blocks (38 Verdict Codes)

Plimsoll defends against threat vectors across 8 patch generations:

<details>
<summary><strong>Core Defenses</strong></summary>

| Code | Threat |
|------|--------|
| `BLOCK_LOOP_DETECTED` | Hallucination retry spiral |
| `BLOCK_VELOCITY_BREACH` | Spend rate exceeds PID governor |
| `BLOCK_VELOCITY_JITTER` | Attacker probing threshold boundary |
| `BLOCK_ENTROPY_ANOMALY` | Secret / private key in payload |
| `BLOCK_ASSET_REJECTED` | Bad swap, oracle liquidity fail, stale intent |
| `BLOCK_GLOBAL_BLACKLIST` | Known malicious address or selector |
| `BLOCK_QUANTIZATION_REJECTED` | Steganographic numeric channel |
| `BLOCK_SIMULATION_REJECTED` | Simulation revert, net worth loss, approval exploit |

</details>

<details>
<summary><strong>God-Tier Patches (v1.0.0)</strong></summary>

| Code | Threat |
|------|--------|
| `BLOCK_EIP712_PERMIT` | EIP-712 "Silent Dagger" — malicious typed data signing |
| `BLOCK_REALITY_DESYNC` | Stale simulation block vs. chain head |
| `BLOCK_GAS_VALUE_RATIO` | Paymaster parasite — gas cost exceeds tx value |

</details>

<details>
<summary><strong>Zero-Day Patches (v1.0.1 — v1.0.4)</strong></summary>

| Code | Threat |
|------|--------|
| `BLOCK_METAMORPHIC_CODE` | EXTCODEHASH mismatch — contract mutated post-simulation |
| `BLOCK_COGNITIVE_STARVATION` | Rapid-fire revert loop severing agent cognition |
| `BLOCK_TROJAN_RECEIPT` | Prompt injection via `eth_getTransactionReceipt` |
| `BLOCK_NON_DETERMINISTIC` | State inspector — re-simulate diverges from original |
| `BLOCK_CROSS_CHAIN_REPLAY` | Permit replayed across L1/L2 chains |
| `BLOCK_PAYMASTER_SEVERED` | Paymaster slashing — too many reverts |
| `BLOCK_JSON_POLLUTION` | Duplicate JSON keys with conflicting values |
| `BLOCK_PROXY_UPGRADE` | Unauthorized EIP-1967 implementation slot change |
| `BLOCK_L1_DATA_FEE_ANOMALY` | L1 blob fee spike on rollups |
| `BLOCK_GAS_ANOMALY` | Gas black hole — actual gas >> simulated gas |
| `BLOCK_BUNDLER_ORIGIN_MISMATCH` | ERC-4337 bundler illusion |
| `BLOCK_PVG_CEILING_EXCEEDED` | Pre-verification gas heist |
| `BLOCK_BRIDGE_REFUND_HIJACK` | Bridge refund to attacker address |
| `BLOCK_PERMIT_EXPIRY_TOO_LONG` | Permit2 time-bomb (immortal signature) |

</details>

<details>
<summary><strong>Multi-Chain Defenses (v2.0)</strong></summary>

| Code | Threat |
|------|--------|
| `BLOCK_SVM_UNAUTHORIZED_WRITABLE` | Solana: unauthorized writable account |
| `BLOCK_UTXO_FEE_EXCESSIVE` | Bitcoin: fee exceeds conservation-of-mass limit |
| `BLOCK_HTTP_BUDGET_EXCEEDED` | Web2 API: spend exceeds budget |
| `BLOCK_INTENT_REJECTED` | Universal intent failed validation |

</details>

---

## Architecture

```
plimsoll-protocol/
├── plimsoll/                    # Python SDK (pip install plimsoll-protocol)
│   ├── firewall.py              # Main orchestrator — chains 7 engines
│   ├── decorator.py             # @with_plimsoll_firewall drop-in wrapper
│   ├── verdict.py               # 38 verdict codes + cognitive feedback
│   ├── intent.py                # Universal intent (EVM/SVM/UTXO/HTTP)
│   ├── escrow.py                # Human-in-the-loop approval queue
│   ├── engines/                 # 7 deterministic math engines
│   ├── enclave/                 # KeyVault + TEE abstraction (Nitro/SGX/TZ)
│   ├── proxy/                   # ASGI interceptor (JSON-RPC + REST)
│   ├── vault/                   # On-chain vault SDK (ERC-4337)
│   ├── integrations/            # LangChain, Eliza, Automaton, OpenClaw
│   ├── oracles/                 # Price feed (Pyth, Chainlink, CoinGecko)
│   └── cli/                     # plimsoll init | up | status
│
├── plimsoll-rpc/                # Rust RPC proxy (axum + revm + Flashbots)
│   └── src/                     # 15 modules: simulator, inspector, sanitizer,
│                                #   threat_feed, flashbots, svm_simulator,
│                                #   utxo_guard, telemetry, fee, http_proxy...
│
├── contracts/
│   ├── src/
│   │   ├── PlimsollVault.sol    # ERC-4337 smart account + on-chain physics
│   │   ├── PlimsollAttestation.sol  # Proof of Bounded Risk (PoBR) registry
│   │   └── PlimsollEASAdapter.sol   # Ethereum Attestation Service bridge
│   ├── solana/                  # Anchor program — PDA vault + cosigner
│   └── bitcoin/                 # Taproot 2-of-2 (P2TR + CSV recovery)
│
├── indexer/                     # Rust multi-chain event indexer (Tokio)
├── dapp/                        # React + wagmi dashboard
├── deploy/nitro/                # AWS Nitro Enclave (Terraform + KMS bootstrap)
├── demo/                        # Terminal demos + live GPT-4o agent demo
└── tests/                       # 836 tests across 5 languages
```

---

## Multi-Chain Support

Plimsoll is chain-agnostic. The `NormalizedIntent` system translates any chain's payload into a dimensionless object that all engines can evaluate.

| Chain | On-Chain Vault | Off-Chain Proxy | Status |
|-------|---------------|----------------|--------|
| **Ethereum + L2s** | `PlimsollVault.sol` (ERC-4337) | `plimsoll-rpc` (revm simulation) | Production |
| **Solana** | Anchor PDA vault + cosigner | SVM writable-account guard | Production |
| **Bitcoin** | Taproot 2-of-2 + CSV recovery | UTXO conservation-of-mass | Production |
| **Web2 APIs** | — | HTTP cost extraction | Production |

### Supported L2s

Optimism, Base, Arbitrum One, Arbitrum Nova, zkSync Era, Polygon zkEVM, Scroll, Linea, Zora — with L1 data fee awareness and chain-specific TVAR computation.

---

## Framework Integrations

```python
# LangChain
from plimsoll.integrations.langchain import plimsoll_tool

@plimsoll_tool(firewall)
@tool
def swap_tokens(token_in: str, token_out: str, amount: float):
    ...

# Eliza
from plimsoll.integrations.eliza import PlimsollElizaAction
protected = PlimsollElizaAction(firewall=firewall, inner_action=my_action)

# Automaton (Conway)
from plimsoll.integrations.automaton import PlimsollAutomatonWallet
wallet = PlimsollAutomatonWallet(firewall=firewall, inner_wallet=raw_wallet)

# OpenClaw
from plimsoll.integrations.openclaw import PlimsollDeFiTools
tools = PlimsollDeFiTools(firewall=firewall)
tools.register("swap", swap_fn, spend_key="amount")
```

---

## On-Chain Contracts

### PlimsollVault (Ethereum)

ERC-4337 smart account with pluggable physics modules:

- **VelocityLimitModule** — Hourly spend cap + single-tx cap with sliding window
- **TargetWhitelistModule** — Only approved contract addresses
- **DrawdownGuardModule** — Max drawdown from initial deposit (basis points)

Session keys scope AI agents to time-limited, budget-capped execution.

### Proof of Bounded Risk (PoBR)

`PlimsollAttestation.sol` mints on-chain attestations: *"This vault's max daily drawdown is 5%."* DeFi protocols (Aave, Morpho) query PoBR to grant under-collateralized leverage to provably-bounded agents. Bridges to Ethereum Attestation Service (EAS) via `PlimsollEASAdapter.sol`.

### Solana Vault

Anchor program with PDA vault (`seeds = ["plimsoll-vault", owner]`), cosigner-enforced CPI execution, session keys with daily budget and single-tx cap, on-chain velocity limit, and emergency lock.

### Bitcoin Vault

P2TR (Taproot) 2-of-2 with `CHECKSIGVERIFY` + `CHECKSIG` script-path spending. NUMS internal key forces all spends through the script path. `OP_CHECKSEQUENCEVERIFY` recovery after 144 blocks (~24h). PSBT validation with conservation-of-mass fee guard.

---

## RPC Proxy (Rust)

For teams that want zero-code integration: point your agent's RPC URL at Plimsoll.

```
Agent ──▶ plimsoll-rpc (localhost:8545)
              │
              ├── Intercept eth_sendTransaction
              ├── Simulate in local revm shadow-fork
              ├── Check state deltas against physics
              ├── Sanitize RPC responses (anti-prompt-injection)
              ├── Route through Flashbots Protect (MEV shield)
              └── Collect 1-2 bps protocol fee
```

```bash
# Docker
docker compose -f plimsoll-rpc/docker-compose.yml up

# Or from source
cd plimsoll-rpc && cargo run --release
```

---

## Deployment

### AWS Nitro Enclave

The signing key lives inside an AWS Nitro Enclave with **no network, no disk, no debug access**. KMS delivers the data key only after PCR0 attestation (SHA-384 hash of the enclave image). Even AWS admins cannot decrypt without the matching enclave.

```bash
cd deploy/nitro
terraform init && terraform apply
nitro-cli build-enclave --docker-uri plimsoll-enclave --output-file plimsoll.eif
nitro-cli run-enclave --eif-path plimsoll.eif --memory 512 --cpu-count 2
```

Key derivation: `HKDF-SHA256(kms_data_key, info="plimsoll-signing-key-v1")` — deterministic across reboots from the same wrapped blob.

### CLI

```bash
plimsoll init       # Generate plimsoll.toml interactively
plimsoll up -d      # Start Dockerized RPC proxy (detached)
plimsoll status     # Health check
```

---

## Demo

### Terminal demo (no keys needed)

```bash
python3 demo/scare_campaign.py
```

Simulates three attack vectors side-by-side — unprotected agent vs. Plimsoll-protected agent:

1. **Rapid Wallet Drain** — 4 rapid-fire transfers to a hacker address ($400, $300, $200, $100). Velocity engine blocks after $700.
2. **Private Key Exfiltration** — Agent POSTs its private key to an evil server. Entropy guard catches the 256-bit hex pattern.
3. **Hallucination Retry Loop** — 5 identical swap attempts. Trajectory hash blocks after the 3rd duplicate in 60 seconds.

### Live agent demo (GPT-4o + Sepolia)

```bash
export OPENAI_API_KEY=sk-...
python3 demo/live_agent.py             # dry-run (default)
python3 demo/live_agent.py --live      # real Sepolia transactions
```

A real GPT-4o-mini agent manages funds on Ethereum Sepolia. Phase 1: legitimate operations pass. Phase 2: prompt injection attack — Plimsoll catches and blocks in real-time.

---

## Installation

### Python SDK

```bash
pip install plimsoll-protocol

# With framework integrations
pip install "plimsoll-protocol[langchain]"
pip install "plimsoll-protocol[automaton]"
pip install "plimsoll-protocol[eliza]"

# Everything
pip install "plimsoll-protocol[dev]"
```

### From source

```bash
git clone https://github.com/scoootscooob/plimsoll-protocol.git
cd plimsoll-protocol
pip install -e ".[dev]"
python3 -m pytest tests/ -v  # 540 tests
```

### Rust RPC proxy

```bash
cd plimsoll-rpc
cargo build --release
```

### Smart contracts (Foundry)

```bash
cd contracts
forge build
forge test  # 170 tests
```

---

## Test Suite

836 tests across 5 languages. Zero failures.

| Suite | Language | Tests | Coverage |
|-------|----------|------:|----------|
| Core SDK + Engines + Vault + KMS | Python | 540 | Firewall, 7 engines, vault security, escrow, intents, CLI, 4 integrations, 16 zero-day patches |
| RPC Proxy + Simulator + MEV | Rust | 77 | EVM simulation, Flashbots, sanitizer, threat feed, UTXO guard, SVM simulator |
| Bitcoin Taproot | Rust | 14 | Script construction, PSBT validation, fee conservation, CSV recovery |
| Fleet Indexer | Rust | 35 | EVM/Solana event parsing, dedup, USD enrichment, schema validation |
| Smart Contracts | Solidity | 170 | Vault, session keys, modules, attestation, EAS adapter, fuzz tests |

```bash
# Run everything
python3 -m pytest tests/ -v                                        # Python (540)
cd plimsoll-rpc && cargo test                                      # Rust RPC (77)
cd contracts/bitcoin && cargo test                                 # Rust BTC (14)
cd indexer && cargo test                                           # Rust Indexer (35)
cd contracts && forge test                                         # Solidity (170)
```

---

## Configuration

```python
from plimsoll import PlimsollFirewall, PlimsollConfig

firewall = PlimsollFirewall(config=PlimsollConfig(
    # Capital Velocity (PID governor)
    v_max=100.0,               # Max $/window
    window_seconds=300.0,       # 5-minute sliding window
    k_p=1.0, k_i=0.3, k_d=0.5,  # PID gains
    pid_threshold=2.0,          # Block when PID signal > threshold

    # Trajectory Hash (loop detection)
    trajectory_window_seconds=60.0,
    trajectory_max_duplicates=3,

    # Entropy Guard (secret detection)
    entropy_threshold=5.0,

    # Cognitive Starvation Defense
    strike_max=5,               # Max blocks in window before sever
    strike_window_secs=60,
    sever_duration_secs=900,    # 15-min cooldown

    # ERC-4337 Defenses
    max_pre_verification_gas=0,   # 0 = disabled, set to cap PVG
    max_permit_duration_secs=0,   # 0 = disabled, set to cap permit TTL

    # Chain awareness
    chain_id=1,                 # Mainnet (enables L2 fee computation)
))
```

---

## Roadmap

- [x] 7 deterministic math engines
- [x] Context-window airgap (KeyVault)
- [x] 16 zero-day / kill-shot security patches
- [x] ERC-4337 smart account with on-chain physics
- [x] Proof of Bounded Risk (PoBR) attestation
- [x] Multi-chain support (EVM, Solana, Bitcoin, Web2)
- [x] Rust RPC proxy with revm simulation + Flashbots
- [x] AWS Nitro Enclave with KMS/PCR0 bootstrap
- [x] Fleet indexer for enterprise dashboard
- [x] 4 framework integrations (LangChain, Eliza, Automaton, OpenClaw)
- [ ] MPC signing (Turnkey integration)
- [ ] Formal verification of engine invariants
- [ ] Cross-agent reputation graph
- [ ] Autonomous rebalancing within PoBR bounds

---

## Security

Plimsoll is security infrastructure. If you find a vulnerability:

- **Do not open a public issue.**
- Email: [security contact TBD]
- We will acknowledge within 24 hours.

Design principles:
- **Fail closed** — if any engine errors, the transaction is blocked.
- **Deterministic** — no randomness in block decisions (jitter is HMAC-derived, not random).
- **Defense in depth** — 7 engines, each catching a different class of attack.
- **Zero trust** — the LLM is treated as an untrusted input source.

---

## Contributing

Contributions welcome. Please:

1. Fork the repository
2. Create a feature branch
3. Ensure all 836 tests pass
4. Submit a pull request

---

## License

[MIT](LICENSE) — Use it, fork it, protect your agents.

---

<p align="center">
  <sub>Built for the era when AI agents hold real money.</sub>
</p>
