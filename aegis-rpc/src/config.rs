//! Configuration for the Aegis RPC Proxy.

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    /// Upstream Ethereum RPC URL (Alchemy, Infura, etc.)
    pub upstream_rpc_url: String,

    /// Host to bind to
    pub host: String,

    /// Port to listen on
    pub port: u16,

    /// Fee in basis points (1 bps = 0.01%)
    pub fee_bps: u16,

    /// Fee collector address (receives the protocol fee)
    pub fee_collector: String,

    /// Maximum allowed net-worth loss percentage in simulation
    pub max_loss_pct: f64,

    /// Block transactions that modify token approvals
    pub block_approval_changes: bool,

    /// Enable Flashbots MEV-shielded routing
    pub flashbots_enabled: bool,

    /// Flashbots relay URL
    pub flashbots_relay_url: String,

    /// Block number to fork from (0 = latest)
    pub fork_block: u64,

    /// Zero-Day 1: Simulation gas ceiling (default: 5M).
    /// Prevents flashloan gas bomb attacks from pegging CPU.
    pub simulation_gas_ceiling: u64,

    /// Zero-Day 1: Simulation wall-clock timeout in milliseconds (default: 50ms).
    /// Catches opcodes cheap in gas but expensive in real time.
    pub simulation_timeout_ms: u64,

    /// Zero-Day 3: Maximum bundle deadline in seconds from current block timestamp.
    /// Prevents MEV builders from holding transactions indefinitely.
    pub max_bundle_deadline_secs: u64,

    // ── v1.0.2: Zero-Day Patch Configuration ─────────────────────

    /// Patch 1 (Trojan Receipt): Sanitize read-path RPC responses to strip
    /// LLM control tokens injected in malicious contract return data.
    pub sanitize_read_responses: bool,

    /// Patch 2 (Schrödinger's State): Detect non-deterministic JUMPI conditions
    /// caused by environmental opcodes (BLOCKHASH, COINBASE, TIMESTAMP, etc.).
    pub detect_non_determinism: bool,

    /// Patch 3 (Cross-Chain Replay): Expected chainId for EIP-712 domain
    /// validation. 0 = disabled (backward compatibility).
    pub expected_chain_id: u64,

    /// Patch 4 (Paymaster Slashing): Maximum gas per UserOperation.
    /// 0 = disabled.
    pub max_userop_gas: u64,

    /// Patch 4 (Paymaster Slashing): Maximum revert strikes before sever.
    /// 0 = disabled.
    pub revert_strike_max: u32,

    /// Patch 4 (Paymaster Slashing): Rolling window in seconds for revert strikes.
    pub revert_strike_window_secs: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            upstream_rpc_url: std::env::var("AEGIS_UPSTREAM_RPC")
                .unwrap_or_else(|_| "https://eth-mainnet.g.alchemy.com/v2/demo".into()),
            host: std::env::var("AEGIS_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("AEGIS_PORT")
                .unwrap_or_else(|_| "8545".into())
                .parse()
                .context("Invalid AEGIS_PORT")?,
            fee_bps: std::env::var("AEGIS_FEE_BPS")
                .unwrap_or_else(|_| "2".into())
                .parse()
                .context("Invalid AEGIS_FEE_BPS")?,
            fee_collector: std::env::var("AEGIS_FEE_COLLECTOR")
                .unwrap_or_else(|_| "0x0000000000000000000000000000000000000000".into()),
            max_loss_pct: std::env::var("AEGIS_MAX_LOSS_PCT")
                .unwrap_or_else(|_| "20.0".into())
                .parse()
                .context("Invalid AEGIS_MAX_LOSS_PCT")?,
            block_approval_changes: std::env::var("AEGIS_BLOCK_APPROVALS")
                .unwrap_or_else(|_| "true".into())
                .parse()
                .unwrap_or(true),
            flashbots_enabled: std::env::var("AEGIS_FLASHBOTS_ENABLED")
                .unwrap_or_else(|_| "false".into())
                .parse()
                .unwrap_or(false),
            flashbots_relay_url: std::env::var("AEGIS_FLASHBOTS_RELAY")
                .unwrap_or_else(|_| "https://relay.flashbots.net".into()),
            fork_block: std::env::var("AEGIS_FORK_BLOCK")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .unwrap_or(0),
            simulation_gas_ceiling: std::env::var("AEGIS_SIM_GAS_CEILING")
                .unwrap_or_else(|_| "5000000".into())
                .parse()
                .unwrap_or(5_000_000),
            simulation_timeout_ms: std::env::var("AEGIS_SIM_TIMEOUT_MS")
                .unwrap_or_else(|_| "50".into())
                .parse()
                .unwrap_or(50),
            max_bundle_deadline_secs: std::env::var("AEGIS_MAX_BUNDLE_DEADLINE")
                .unwrap_or_else(|_| "24".into())
                .parse()
                .unwrap_or(24),
            sanitize_read_responses: std::env::var("AEGIS_SANITIZE_READS")
                .unwrap_or_else(|_| "false".into())
                .parse()
                .unwrap_or(false),
            detect_non_determinism: std::env::var("AEGIS_DETECT_NONDET")
                .unwrap_or_else(|_| "false".into())
                .parse()
                .unwrap_or(false),
            expected_chain_id: std::env::var("AEGIS_EXPECTED_CHAIN_ID")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .unwrap_or(0),
            max_userop_gas: std::env::var("AEGIS_MAX_USEROP_GAS")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .unwrap_or(0),
            revert_strike_max: std::env::var("AEGIS_REVERT_STRIKE_MAX")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .unwrap_or(0),
            revert_strike_window_secs: std::env::var("AEGIS_REVERT_STRIKE_WINDOW")
                .unwrap_or_else(|_| "300".into())
                .parse()
                .unwrap_or(300),
        })
    }
}
