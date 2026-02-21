//! HTTP API for the Plimsoll Fleet Indexer.
//!
//! Provides REST endpoints for querying indexed vault data.
//! Serves vault-by-owner lookups so the dApp dashboard can
//! auto-discover factory-deployed vaults.

use crate::processor::EventProcessor;
use crate::schema::EventType;

use axum::{
    extract::{Path, State},
    http::Method,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

// ── Response Types ──────────────────────────────────────────────

#[derive(Serialize)]
pub struct VaultInfo {
    pub vault_address: String,
    pub chain_id: u64,
    pub chain_name: String,
    pub velocity_module: String,
    pub whitelist_module: String,
    pub drawdown_module: String,
    pub deploy_tx_hash: String,
    pub block_number: u64,
}

#[derive(Serialize)]
pub struct VaultsResponse {
    pub owner: String,
    pub vaults: Vec<VaultInfo>,
    pub count: usize,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub pending_events: usize,
}

// ── Handlers ────────────────────────────────────────────────────

/// GET /vaults/:owner — returns all vaults owned by the given address.
///
/// In production, this queries the `vault_registry` PostgreSQL table.
/// For now, it scans the processor's pending batch for VaultCreated events.
async fn get_vaults_by_owner(
    Path(owner): Path<String>,
    State(processor): State<Arc<EventProcessor>>,
) -> Json<VaultsResponse> {
    let owner_lower = owner.to_lowercase();

    // Scan pending batch for VaultCreated events matching this owner.
    // In production: SELECT * FROM vault_registry WHERE owner_address = $1
    let vaults = processor.find_vaults_by_owner(&owner_lower);

    let count = vaults.len();
    Json(VaultsResponse {
        owner,
        vaults,
        count,
    })
}

/// GET /health — health check endpoint.
async fn health(
    State(processor): State<Arc<EventProcessor>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        pending_events: processor.pending_count(),
    })
}

// ── Router ──────────────────────────────────────────────────────

/// Build the axum router with CORS enabled.
pub fn build_router(processor: Arc<EventProcessor>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET])
        .allow_headers(Any);

    Router::new()
        .route("/vaults/{owner}", get(get_vaults_by_owner))
        .route("/health", get(health))
        .layer(cors)
        .with_state(processor)
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_response_serializes() {
        let resp = HealthResponse {
            status: "ok".into(),
            pending_events: 42,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"pending_events\":42"));
    }

    #[test]
    fn test_vaults_response_serializes() {
        let resp = VaultsResponse {
            owner: "0xOwner".into(),
            vaults: vec![VaultInfo {
                vault_address: "0xVault".into(),
                chain_id: 1,
                chain_name: "ethereum".into(),
                velocity_module: "0xVel".into(),
                whitelist_module: "0xWl".into(),
                drawdown_module: "0xDd".into(),
                deploy_tx_hash: "0xTx".into(),
                block_number: 100,
            }],
            count: 1,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"owner\":\"0xOwner\""));
        assert!(json.contains("\"vault_address\":\"0xVault\""));
        assert!(json.contains("\"count\":1"));
    }
}
