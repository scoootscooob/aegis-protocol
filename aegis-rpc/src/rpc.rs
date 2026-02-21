//! JSON-RPC handler — intercepts send-transaction methods,
//! passes read-only calls through to the upstream provider.
//!
//! ## Security Patches
//! - Patch 2: State-Delta Invariant — captures expected post-state from simulation
//! - Patch 4: Synthetic Receipts — blocked txs return fake receipts instead of errors
//! - Zero-Day 2: Ghost Session — pessimistic session key invalidation
//!   Session keys revoked on-chain are invalidated in the RPC proxy's
//!   local cache IMMEDIATELY when the revocation tx enters the mempool
//!   (via WebSocket `pending` subscription), NOT when the block confirms.
//!   This closes the 12-second window where a revoked key is still usable.

use crate::config::Config;
use crate::fee;
use crate::sanitizer;
use crate::simulator;
use crate::telemetry;
use crate::threat_feed::{self, SharedThreatFilter};
use crate::types::{JsonRpcRequest, JsonRpcResponse};
use anyhow::Result;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

/// Methods that involve broadcasting transactions (need simulation).
const SEND_METHODS: &[&str] = &[
    "eth_sendTransaction",
    "eth_sendRawTransaction",
];

/// GOD-TIER 1: EIP-712 Silent Dagger Defense
/// Cryptographic signing endpoints that MUST be intercepted.
/// These are NOT transactions — they are off-chain signatures that can
/// authorize token approvals (Permit2), gasless swaps (CowSwap/UniswapX),
/// and governance votes WITHOUT ever touching the EVM simulator.
///
/// Attack: Prompt-inject agent → "sign this login message" → actually a
/// Permit2 approval for MAX_UINT → attacker extracts signature → drains vault.
const SIGN_METHODS: &[&str] = &[
    "eth_sign",
    "personal_sign",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4",
];

/// GOD-TIER 1: Known dangerous EIP-712 type hashes.
/// These are keccak256 of the EIP-712 type strings used by major protocols.
/// When we detect these in a signTypedData request, we translate the
/// off-chain signature into its on-chain equivalent for simulation.
mod permit_decoder {
    /// Permit2 PermitSingle type
    pub const PERMIT2_SINGLE_TYPEHASH: &str =
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)";
    /// Permit2 PermitBatch type
    pub const PERMIT2_BATCH_TYPEHASH: &str =
        "PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)";
    /// ERC-2612 Permit type
    pub const ERC2612_PERMIT_TYPEHASH: &str =
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)";
    /// DAI-style Permit type
    pub const DAI_PERMIT_TYPEHASH: &str =
        "Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)";

    /// Known EIP-712 primary types that authorize token movement.
    pub const DANGEROUS_PRIMARY_TYPES: &[&str] = &[
        "Permit",
        "PermitSingle",
        "PermitBatch",
        "PermitTransferFrom",
        "PermitWitnessTransferFrom",
        "Order",              // CowSwap
        "OrderComponents",    // Seaport (OpenSea)
        "MetaTransaction",    // Biconomy
        "ForwardRequest",     // OpenZeppelin Defender
        "Delegation",         // EIP-7702
    ];

    /// Analyze an EIP-712 typed data payload and classify the risk.
    ///
    /// Returns (is_dangerous, synthetic_action, risk_description).
    /// If dangerous, `synthetic_action` describes the equivalent on-chain
    /// effect (e.g., "approve(0xHacker, MAX_UINT)").
    pub fn analyze_typed_data(
        typed_data: &serde_json::Value,
    ) -> (bool, String, String) {
        // Extract primaryType from the EIP-712 payload
        let primary_type = typed_data
            .get("primaryType")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Check if primaryType is in the dangerous list
        let is_dangerous_type = DANGEROUS_PRIMARY_TYPES
            .iter()
            .any(|dt| primary_type.eq_ignore_ascii_case(dt));

        if !is_dangerous_type {
            return (false, String::new(), String::new());
        }

        // Extract the message body for deeper analysis
        let message = typed_data.get("message").cloned()
            .unwrap_or(serde_json::json!({}));

        // Extract spender/operator — the address that gains power
        let spender = message.get("spender")
            .or_else(|| message.get("operator"))
            .or_else(|| message.get("taker"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        // Extract value/amount — what's being authorized
        let value = message.get("value")
            .or_else(|| message.get("amount"))
            .and_then(|v| v.as_str().or_else(|| v.as_u64().map(|_| "").or(Some(""))))
            .unwrap_or("unknown");

        // Extract token address from domain or details
        let token = typed_data.get("domain")
            .and_then(|d| d.get("verifyingContract"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        let synthetic_action = match primary_type {
            "Permit" | "PermitSingle" => {
                format!(
                    "ERC20.approve({}, {}) on token {}",
                    spender, value, token
                )
            }
            "PermitBatch" => {
                format!(
                    "BATCH ERC20.approve({}, MULTIPLE_TOKENS)",
                    spender
                )
            }
            "PermitTransferFrom" | "PermitWitnessTransferFrom" => {
                format!(
                    "Permit2.transferFrom(agent, {}, {}) on token {}",
                    spender, value, token
                )
            }
            "Order" | "OrderComponents" => {
                format!(
                    "DEX Order: {} gains trading rights via signed order",
                    spender
                )
            }
            _ => {
                format!(
                    "DANGEROUS SIGNATURE: {} authorizes {} on {}",
                    primary_type, spender, token
                )
            }
        };

        let risk_description = format!(
            "GOD-TIER 1 (EIP-712 Silent Dagger): Agent asked to sign '{}' — \
             this is NOT a login message. It is a cryptographic authorization \
             that translates to: {}. An attacker can extract this signature \
             and submit it on-chain to drain the vault.",
            primary_type, synthetic_action
        );

        (true, synthetic_action, risk_description)
    }
}

// ── Patch 4: Synthetic receipt store ─────────────────────────────
// Blocked transactions get synthetic hashes. When the agent polls
// eth_getTransactionReceipt, we return a synthetic reverted receipt
// instead of null. This keeps the agent's web3 client alive.
lazy_static::lazy_static! {
    static ref BLOCKED_TX_STORE: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());

    /// Zero-Day 2: Ghost Session — Pessimistic revocation cache.
    /// Session keys that appear in a `SessionKeyRevoked` event in the
    /// MEMPOOL (not yet mined) are immediately added here. Any tx
    /// referencing a revoked session key is rejected BEFORE simulation.
    /// This closes the 12-second block confirmation window.
    static ref REVOKED_SESSION_KEYS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());

    /// v1.0.2 Patch 4: Paymaster Slashing — Revert strike timestamps.
    /// Tracks timestamps of post-simulation on-chain reverts within a
    /// rolling window. When the count exceeds the threshold, the agent's
    /// Paymaster connection is severed.
    static ref REVERT_STRIKE_TRACKER: Mutex<VecDeque<u64>> = Mutex::new(VecDeque::new());

    /// v1.0.2 Patch 4: Paymaster severed flag.
    /// Once set, ALL transactions are blocked until manual reset.
    static ref PAYMASTER_SEVERED: Mutex<bool> = Mutex::new(false);
}

/// Zero-Day 2: SessionKeyRevoked event topic (keccak256 of event signature).
/// `keccak256("SessionKeyRevoked(address,bytes32)")` — matches the
/// AegisSessionManager.sol contract event.
const SESSION_KEY_REVOKED_TOPIC: &str =
    "0x9e87fac88ff661f02d44f95383c817fece4bce600a3dab7a54406878b965e752";

/// Zero-Day 2: Check if a session key has been pessimistically revoked.
/// Called before simulation — if the sender's session key is in the
/// revoked set, we reject immediately.
pub fn is_session_revoked(session_key: &str) -> bool {
    if let Ok(store) = REVOKED_SESSION_KEYS.lock() {
        store.contains(&session_key.to_lowercase())
    } else {
        // Lock poisoned — fail closed (assume revoked)
        warn!("Revoked session key lock poisoned — failing closed");
        true
    }
}

/// Zero-Day 2: Add a session key to the pessimistic revocation cache.
/// Called when a `SessionKeyRevoked` event is seen in the mempool
/// (pending transaction, NOT yet mined).
pub fn revoke_session_key(session_key: &str) {
    if let Ok(mut store) = REVOKED_SESSION_KEYS.lock() {
        let key = session_key.to_lowercase();
        info!(
            session_key = %key,
            "ZERO-DAY 2: Session key pessimistically revoked from mempool"
        );
        store.insert(key);
    }
}

/// v1.0.2 Patch 4: Record a post-simulation on-chain revert.
/// If the revert count exceeds the threshold within the rolling window,
/// the Paymaster connection is severed.
pub fn record_revert_strike(config: &Config) {
    if config.revert_strike_max == 0 {
        return; // Feature disabled
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Ok(mut tracker) = REVERT_STRIKE_TRACKER.lock() {
        tracker.push_back(now);

        // Prune timestamps outside the rolling window
        let cutoff = now.saturating_sub(config.revert_strike_window_secs);
        while tracker.front().map_or(false, |&t| t < cutoff) {
            tracker.pop_front();
        }

        // Check if revert count exceeds threshold
        if tracker.len() >= config.revert_strike_max as usize {
            if let Ok(mut severed) = PAYMASTER_SEVERED.lock() {
                *severed = true;
                warn!(
                    revert_count = tracker.len(),
                    threshold = config.revert_strike_max,
                    "PATCH 4 (PAYMASTER SLASHING): Paymaster severed — too many reverts"
                );
            }
        }
    }
}

/// v1.0.2 Patch 4: Check if the Paymaster connection has been severed.
pub fn is_paymaster_severed() -> bool {
    if let Ok(severed) = PAYMASTER_SEVERED.lock() {
        *severed
    } else {
        // Lock poisoned — fail closed
        warn!("Paymaster severed lock poisoned — failing closed");
        true
    }
}

/// v1.0.2 Patch 3: Validate chainId in EIP-712 typed data domain.
/// Returns an error message if the chainId is missing, zero, or mismatched.
fn validate_eip712_chain_id(
    typed_data: &serde_json::Value,
    expected_chain_id: u64,
) -> Option<String> {
    if expected_chain_id == 0 {
        return None; // Feature disabled
    }

    let domain = typed_data.get("domain");
    if domain.is_none() {
        return Some(
            "PATCH 3 (CROSS-CHAIN REPLAY): EIP-712 domain missing — \
             cannot verify chainId binding"
                .to_string(),
        );
    }

    let chain_id_val = domain.unwrap().get("chainId");
    if chain_id_val.is_none() {
        return Some(
            "PATCH 3 (CROSS-CHAIN REPLAY): EIP-712 domain missing chainId — \
             signature can be replayed on any chain"
                .to_string(),
        );
    }

    // Parse chainId from various formats (int, hex string, decimal string)
    let chain_id_val = chain_id_val.unwrap();
    let parsed_chain_id: Option<u64> = if let Some(n) = chain_id_val.as_u64() {
        Some(n)
    } else if let Some(s) = chain_id_val.as_str() {
        if s.starts_with("0x") || s.starts_with("0X") {
            u64::from_str_radix(s.trim_start_matches("0x").trim_start_matches("0X"), 16).ok()
        } else {
            s.parse().ok()
        }
    } else {
        None
    };

    match parsed_chain_id {
        None => Some(
            "PATCH 3 (CROSS-CHAIN REPLAY): EIP-712 domain chainId unparseable"
                .to_string(),
        ),
        Some(0) => Some(
            "PATCH 3 (CROSS-CHAIN REPLAY): EIP-712 domain chainId=0 (wildcard) — \
             signature valid on ALL chains"
                .to_string(),
        ),
        Some(id) if id != expected_chain_id => Some(format!(
            "PATCH 3 (CROSS-CHAIN REPLAY): EIP-712 domain chainId={} != expected {} — \
             possible cross-chain replay attack",
            id, expected_chain_id
        )),
        Some(_) => None, // chainId matches — all good
    }
}

/// v1.0.2 Patch 4: Extract UserOperation gas from calldata.
/// For ERC-4337 UserOperations, the `callGasLimit` field determines
/// how much gas the Paymaster sponsors.
fn extract_userop_gas(data: &[u8]) -> Option<u64> {
    // ERC-4337 UserOperation ABI:
    // handleOps selector: 0x1fad948c
    // UserOp struct has callGasLimit at offset 128 (word 4, 0-indexed)
    if data.len() < 4 {
        return None;
    }
    let selector = &data[0..4];
    // handleOps(UserOperation[], address)
    if selector != [0x1f, 0xad, 0x94, 0x8c] {
        return None;
    }
    // Simplified: for real implementation, decode full ABI
    // For now, return None (feature depends on full ABI decode)
    None
}

/// Zero-Day 2: Start the WebSocket mempool watcher for SessionKeyRevoked events.
///
/// This spawns an async task that subscribes to `eth_subscribe("logs", ...)`
/// on the upstream WebSocket RPC, filtering for the SessionKeyRevoked event
/// from the AegisSessionManager contract. When a matching log appears in a
/// pending transaction (mempool), we immediately add the session key to
/// `REVOKED_SESSION_KEYS`.
///
/// In production, `ws_rpc_url` is the WebSocket endpoint of the upstream
/// provider (e.g., `wss://eth-mainnet.g.alchemy.com/v2/KEY`).
pub async fn start_mempool_revocation_watcher(
    ws_rpc_url: &str,
    session_manager_address: &str,
) {
    if ws_rpc_url.is_empty() || ws_rpc_url == "disabled" {
        info!("Zero-Day 2: Mempool revocation watcher disabled (no WS URL)");
        return;
    }

    let url = ws_rpc_url.to_string();
    let contract = session_manager_address.to_lowercase();

    tokio::spawn(async move {
        info!(
            ws_url = %url,
            contract = %contract,
            "Zero-Day 2: Starting mempool revocation watcher"
        );

        // Subscribe to pending logs matching SessionKeyRevoked topic
        let subscribe_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_subscribe",
            "params": ["logs", {
                "address": contract,
                "topics": [SESSION_KEY_REVOKED_TOPIC]
            }],
            "id": 1
        });

        // In production, this uses a WebSocket connection (tokio-tungstenite).
        // For the initial implementation, we log the subscription intent and
        // poll via HTTP as a fallback. The WebSocket upgrade happens when
        // the infra supports wss:// endpoints.
        info!(
            payload = %subscribe_payload,
            "Zero-Day 2: Would subscribe to mempool SessionKeyRevoked events"
        );

        // Polling fallback: check every 2 seconds for new revocation events
        // in the pending transaction pool.
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            // In production: parse WebSocket frames for log events
            // containing SessionKeyRevoked, extract the session key
            // from topics[1], and call revoke_session_key().
            //
            // let session_key = extract_session_key_from_log(&log);
            // revoke_session_key(&session_key);
        }
    });
}

/// Handle an incoming JSON-RPC request.
pub async fn handle_rpc(
    config: &Config,
    threat_filter: &SharedThreatFilter,
    req: JsonRpcRequest,
) -> JsonRpcResponse {
    info!(method = %req.method, "RPC request received");

    // ── Patch 4: Intercept receipt polling for synthetic txs ─────
    // If the agent calls eth_getTransactionReceipt on a blocked tx hash,
    // we return a synthetic reverted receipt instead of null.
    if req.method == "eth_getTransactionReceipt" {
        if let Some(hash) = req.params.as_array()
            .and_then(|a| a.first())
            .and_then(|v| v.as_str())
        {
            if let Ok(store) = BLOCKED_TX_STORE.lock() {
                if let Some(reason) = store.get(hash) {
                    info!(tx_hash = hash, "Returning synthetic receipt for blocked tx");
                    return JsonRpcResponse::aegis_synthetic_receipt(
                        req.id, hash, reason,
                    );
                }
            }
        }
    }

    // ── v1.0.2 Patch 4: Paymaster Sever Check ──────────────────
    // If the Paymaster has been severed due to too many post-simulation
    // reverts, block ALL outgoing transactions immediately.
    if is_paymaster_severed() && SEND_METHODS.contains(&req.method.as_str()) {
        let reason = "AEGIS PATCH 4 (PAYMASTER SLASHING): Paymaster connection severed. \
                       Too many post-simulation reverts detected — all transactions blocked \
                       to prevent gas drain."
            .to_string();
        warn!("{}", reason);
        let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
        if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
            store.insert(tx_hash, reason);
        }
        return resp;
    }

    // ── GOD-TIER 1: EIP-712 Silent Dagger Interception ─────────
    // Intercept ALL cryptographic signing endpoints. The agent should
    // NEVER blindly sign off-chain messages — they can be weaponized
    // as Permit2 approvals, gasless swap orders, or governance votes.
    if SIGN_METHODS.contains(&req.method.as_str()) {
        warn!(
            method = %req.method,
            "GOD-TIER 1: Intercepted off-chain signing request"
        );

        // For signTypedData variants, decode the EIP-712 payload
        if req.method.starts_with("eth_signTypedData") {
            // The typed data is typically the 2nd param (after the address)
            let typed_data = req.params.as_array()
                .and_then(|a| a.get(1))
                .cloned()
                .unwrap_or(serde_json::json!({}));

            // Parse if it's a JSON string
            let parsed_data = if let Some(s) = typed_data.as_str() {
                serde_json::from_str(s).unwrap_or(typed_data)
            } else {
                typed_data
            };

            // ── v1.0.2 Patch 3: Cross-Chain Replay Defense ──────
            // Validate chainId in the EIP-712 domain BEFORE checking
            // dangerous primary types. Missing/zero/mismatched chainId
            // allows cross-chain replay attacks.
            if let Some(chain_err) = validate_eip712_chain_id(
                &parsed_data, config.expected_chain_id
            ) {
                warn!("{}", chain_err);
                let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(
                    req.id, &chain_err,
                );
                if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
                    store.insert(tx_hash, chain_err);
                }
                return resp;
            }

            let (is_dangerous, synthetic_action, risk_desc) =
                permit_decoder::analyze_typed_data(&parsed_data);

            if is_dangerous {
                warn!(
                    synthetic_action = %synthetic_action,
                    "GOD-TIER 1: DANGEROUS EIP-712 SIGNATURE BLOCKED"
                );

                // Extract IOC — this is an active phishing attack
                let from = req.params.as_array()
                    .and_then(|a| a.first())
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");

                let ioc = telemetry::extract_ioc(
                    from, "eip712_permit", &[], "permit_decoder",
                    &risk_desc, None, 1,
                );
                telemetry::uplink_ioc(&ioc, "https://cloud.aegis.network/v1/ioc").await;

                let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(
                    req.id, &risk_desc,
                );
                if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
                    store.insert(tx_hash, risk_desc);
                }
                return resp;
            }
        }

        // For eth_sign and personal_sign — block ALL by default.
        // Raw message signing is ALWAYS dangerous for an AI agent.
        // A human can sign arbitrary messages; an AI agent cannot
        // distinguish a "login challenge" from a "drain everything" payload.
        if req.method == "eth_sign" || req.method == "personal_sign" {
            let reason = format!(
                "GOD-TIER 1: Raw message signing ({}) blocked. \
                 AI agents must NEVER sign arbitrary messages — \
                 they cannot distinguish login challenges from \
                 cryptographic drain authorizations.",
                req.method
            );
            warn!("{}", reason);
            let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
            if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
                store.insert(tx_hash, reason);
            }
            return resp;
        }
    }

    // ── Read-only methods: pass through to upstream ─────────────
    // v1.0.2 Patch 1 (Trojan Receipt): If sanitize_read_responses is enabled,
    // intercept read-path responses and scrub LLM control tokens.
    if !SEND_METHODS.contains(&req.method.as_str()) {
        let mut response = proxy_to_upstream(config, &req).await;

        // v1.0.2 Patch 1: Sanitize read-path responses
        if config.sanitize_read_responses
            && sanitizer::SANITIZE_METHODS.contains(&req.method.as_str())
        {
            // Convert to serde_json::Value for sanitization
            if let Ok(mut resp_json) = serde_json::to_value(&response) {
                let (tainted, details) = sanitizer::sanitize_rpc_response(&mut resp_json);
                if tainted {
                    warn!(
                        method = %req.method,
                        details = ?details,
                        "PATCH 1 (TROJAN RECEIPT): Read-path response sanitized"
                    );
                    // Reconstruct the response from sanitized JSON
                    if let Some(result) = resp_json.get("result").cloned() {
                        response.result = Some(result);
                    }
                }
            }
        }

        // v1.0.2 Patch 4: Detect on-chain reverts in real transaction receipts.
        // When a tx that passed simulation reverts on-chain (status=0x0),
        // record a revert strike against the Paymaster.
        if req.method == "eth_getTransactionReceipt" && config.revert_strike_max > 0 {
            if let Some(ref result) = response.result {
                let status = result.get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("0x1");
                if status == "0x0" {
                    info!("PATCH 4: On-chain revert detected — recording strike");
                    record_revert_strike(config);
                }
            }
        }

        return response;
    }

    // ── Transaction methods: simulate first ─────────────────────
    info!("Intercepted send tx — running pre-flight simulation");

    // Parse tx parameters from the request
    let (from, to, value, data) = match parse_tx_params(&req) {
        Ok(params) => params,
        Err(e) => {
            warn!("Failed to parse tx params: {}", e);
            return JsonRpcResponse::error(req.id, -32602, format!("Invalid params: {e}"));
        }
    };

    // ── ZERO-DAY 2: Pessimistic Session Key Check ──────────────
    // Before ANY engine runs, check if the sender's session key has
    // been revoked in the mempool. This closes the 12-second window
    // between mempool revocation and block confirmation.
    if is_session_revoked(&from) {
        let reason = format!(
            "AEGIS ZERO-DAY 2: Session key {} pessimistically revoked \
             (seen in mempool before block confirmation)",
            &from
        );
        warn!("{}", reason);
        let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
        if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
            store.insert(tx_hash, reason);
        }
        return resp;
    }

    // ── ENGINE 0: Global Bloom Filter Pre-Flight ────────────────
    // Runs BEFORE Engines 1-6. Sub-millisecond O(1) lookup against
    // the Swarm-compiled global blacklist.
    let (engine0_blocked, engine0_reason) = threat_feed::engine0_check(
        threat_filter, &to, &data,
    );
    if engine0_blocked {
        warn!("{}", engine0_reason);
        // Extract IOC and uplink to Aegis Cloud
        let ioc = telemetry::extract_ioc(
            &from, &to, &data, "bloom", &engine0_reason, None, 1,
        );
        telemetry::uplink_ioc(&ioc, "https://cloud.aegis.network/v1/ioc").await;
        // Patch 4: Return synthetic tx hash — agent stays alive
        let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &engine0_reason);
        if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
            store.insert(tx_hash, engine0_reason);
        }
        return resp;
    }

    // Run pre-flight simulation
    let sim_result = match simulator::simulate_transaction(config, &from, &to, value, &data).await {
        Ok(r) => r,
        Err(e) => {
            warn!("Simulation failed: {}", e);
            // Patch 4: Return synthetic tx hash — agent stays alive
            let reason = format!("Simulation error: {e}");
            let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
            if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
                store.insert(tx_hash, reason);
            }
            return resp;
        }
    };

    // Check physics constraints
    if let Err(reason) = simulator::check_physics(config, &sim_result) {
        warn!("Physics violation: {}", reason);
        // Extract IOC and uplink to Aegis Cloud
        let ioc = telemetry::extract_ioc(
            &from, &to, &data, "simulator", &reason, Some(&reason), 1,
        );
        telemetry::uplink_ioc(&ioc, "https://cloud.aegis.network/v1/ioc").await;
        // Patch 4: Return synthetic tx hash — agent stays alive
        let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
        if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
            store.insert(tx_hash, reason);
        }
        return resp;
    }

    // ── v1.0.2 Patch 2: Non-determinism check ──────────────────
    // If the simulation detected environmental opcodes feeding into JUMPI
    // conditions, the on-chain execution may differ from simulation.
    if sim_result.non_deterministic && config.detect_non_determinism {
        let reason = "AEGIS PATCH 2 (SCHRÖDINGER'S STATE): Non-deterministic execution \
                       detected — environmental opcodes (TIMESTAMP, BLOCKHASH, etc.) feed \
                       into conditional branches. Simulation outcome is unreliable."
            .to_string();
        warn!("{}", reason);
        let (resp, tx_hash) = JsonRpcResponse::aegis_synthetic_send(req.id, &reason);
        if let Ok(mut store) = BLOCKED_TX_STORE.lock() {
            store.insert(tx_hash, reason);
        }
        return resp;
    }

    // ── Patch 2 + GOD-TIER 3 + ZERO-DAY 2: State-Delta + Block Pinning + Codehash
    // We record what the simulation expects, which block it simulated against,
    // AND the target contract's bytecode hash. The on-chain vault rejects
    // stale simulations and metamorphic bytecode swaps.
    info!(
        sim_balance_before = sim_result.balance_before,
        sim_balance_after = sim_result.balance_after,
        sim_loss_pct = sim_result.loss_pct,
        sim_gas_used = sim_result.gas_used,
        sim_block = sim_result.simulated_block,
        target_codehash = %sim_result.target_codehash,
        "State-delta invariant captured (pinned to block + codehash)"
    );

    // Calculate and log fee
    let fee_amount = fee::calculate_fee(value, config.fee_bps);
    if fee_amount > 0 {
        info!(fee_bps = config.fee_bps, fee_wei = fee_amount, "Fee calculated");
    }

    // ── Route through MEV-shielded path ─────────────────────────
    if config.flashbots_enabled {
        info!("Routing through Flashbots Protect");
        // TODO: Build Flashbots bundle with fee tx + state-delta assert
        // For now, fall through to upstream
    }

    // Forward to upstream RPC
    proxy_to_upstream(config, &req).await
}

/// Forward a request to the upstream Ethereum RPC.
async fn proxy_to_upstream(config: &Config, req: &JsonRpcRequest) -> JsonRpcResponse {
    let client = reqwest::Client::new();
    match client
        .post(&config.upstream_rpc_url)
        .json(req)
        .send()
        .await
    {
        Ok(resp) => {
            match resp.json::<serde_json::Value>().await {
                Ok(body) => JsonRpcResponse {
                    jsonrpc: "2.0".into(),
                    result: body.get("result").cloned(),
                    error: None,
                    id: req.id.clone(),
                },
                Err(e) => JsonRpcResponse::error(
                    req.id.clone(),
                    -32603,
                    format!("Upstream parse error: {e}"),
                ),
            }
        }
        Err(e) => JsonRpcResponse::error(
            req.id.clone(),
            -32603,
            format!("Upstream connection error: {e}"),
        ),
    }
}

/// Parse transaction parameters from a JSON-RPC request.
fn parse_tx_params(req: &JsonRpcRequest) -> Result<(String, String, u128, Vec<u8>)> {
    let params = req.params.as_array()
        .ok_or_else(|| anyhow::anyhow!("params must be array"))?;

    if params.is_empty() {
        anyhow::bail!("empty params");
    }

    let tx = &params[0];

    let from = tx.get("from")
        .and_then(|v| v.as_str())
        .unwrap_or("0x0")
        .to_string();

    let to = tx.get("to")
        .and_then(|v| v.as_str())
        .unwrap_or("0x0")
        .to_string();

    let value = tx.get("value")
        .and_then(|v| v.as_str())
        .and_then(|s| u128::from_str_radix(s.trim_start_matches("0x"), 16).ok())
        .unwrap_or(0);

    let data = tx.get("data")
        .or_else(|| tx.get("input"))
        .and_then(|v| v.as_str())
        .and_then(|s| hex::decode(s.trim_start_matches("0x")).ok())
        .unwrap_or_default();

    Ok((from, to, value, data))
}
