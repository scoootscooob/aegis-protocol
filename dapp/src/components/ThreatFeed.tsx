"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * ThreatFeed — Live Protection Dashboard
 *
 * Polls the Plimsoll RPC proxy's API endpoints to display:
 * 1. Global protection banner with live stats
 * 2. 7-Engine status grid
 * 3. Active defense features
 * 4. Recent block events
 */

const RPC_BASE =
  process.env.NEXT_PUBLIC_PLIMSOLL_RPC_URL ||
  "https://rpc.plimsoll.network";

interface ThreatFeedStats {
  addresses: number;
  selectors: number;
  calldata_hashes: number;
  total_entries: number;
  version: number;
  consensus_count: number;
  blocks: number;
  last_updated: number;
}

interface ThreatFeedData {
  enabled: boolean;
  stats: ThreatFeedStats;
  immune_protocols: number;
  recent_blocks: BlockEvent[];
  uptime_secs: number;
}

interface EngineInfo {
  name: string;
  id: number;
  enabled: boolean;
  entries?: number;
  blocks: number;
  gtv_enabled?: boolean;
  fail_closed?: boolean;
}

interface Features {
  cognitive_sever: boolean;
  cognitive_sever_config: string;
  paymaster_defense: boolean;
  paymaster_config: string;
  gtv_ratio: boolean;
  gtv_max_ratio: number;
  gas_anomaly: boolean;
  gas_anomaly_ratio: number;
  pvg_ceiling: boolean;
  pvg_max: number;
  chain_id: number;
  whitelist_gate: boolean;
}

interface EnginesData {
  engines: EngineInfo[];
  features: Features;
  total_evaluations: number;
  total_blocks: number;
  engine_block_counts: { name: string; blocks: number }[];
  recent_blocks: BlockEvent[];
  uptime_secs: number;
}

interface BlockEvent {
  timestamp: number;
  engine: string;
  code: string;
  reason: string;
  target: string;
}

function formatUptime(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ThreatFeed() {
  const [threatData, setThreatData] = useState<ThreatFeedData | null>(null);
  const [enginesData, setEnginesData] = useState<EnginesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<number>(0);

  const poll = useCallback(async () => {
    try {
      const [tfResp, engResp] = await Promise.all([
        fetch(`${RPC_BASE}/api/threat-feed`).then((r) => r.json()),
        fetch(`${RPC_BASE}/api/engines`).then((r) => r.json()),
      ]);
      setThreatData(tfResp);
      setEnginesData(engResp);
      setError(null);
      setLastPoll(Date.now());
    } catch (e) {
      setError("Unable to reach Plimsoll RPC proxy");
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 15_000); // Poll every 15s
    return () => clearInterval(interval);
  }, [poll]);

  const isLive = threatData?.enabled && !error;
  const totalEntries = threatData?.stats?.total_entries ?? 0;
  const totalBlocks = enginesData?.total_blocks ?? 0;
  const totalEvals = enginesData?.total_evaluations ?? 0;
  const engines = enginesData?.engines ?? [];
  const features = enginesData?.features;
  const recentBlocks = enginesData?.recent_blocks ?? threatData?.recent_blocks ?? [];

  return (
    <div className="space-y-6">
      {/* ── Section 1: Global Protection Banner ──────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase">
              [ Threat_Feed ]
            </span>
            {isLive ? (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
                </span>
                <span className="font-mono text-[10px] text-green-700 uppercase tracking-widest">
                  Live Protection
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                <span className="font-mono text-[10px] text-red-600 uppercase tracking-widest">
                  {error ?? "Offline"}
                </span>
              </span>
            )}
          </div>
          {lastPoll > 0 && (
            <span className="font-mono text-[10px] text-ink/30">
              Updated {formatTimestamp(lastPoll / 1000)}
            </span>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l border-ink/20">
          <div className="border-r border-b border-ink/20 p-4">
            <div className="font-mono text-[10px] text-ink/40 tracking-widest uppercase">
              Blacklisted Addresses
            </div>
            <div className="font-serif text-2xl mt-1">
              {threatData?.stats?.addresses ?? "—"}
            </div>
          </div>
          <div className="border-r border-b border-ink/20 p-4">
            <div className="font-mono text-[10px] text-ink/40 tracking-widest uppercase">
              Active Engines
            </div>
            <div className="font-serif text-2xl mt-1">
              {engines.filter((e) => e.enabled).length} / 7
            </div>
          </div>
          <div className="border-r border-b border-ink/20 p-4">
            <div className="font-mono text-[10px] text-ink/40 tracking-widest uppercase">
              Total Evaluations
            </div>
            <div className="font-serif text-2xl mt-1">
              {totalEvals.toLocaleString()}
            </div>
          </div>
          <div className="border-r border-b border-ink/20 p-4">
            <div className="font-mono text-[10px] text-ink/40 tracking-widest uppercase">
              Blocked Threats
            </div>
            <div className="font-serif text-2xl mt-1 text-terracotta">
              {totalBlocks.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Uptime */}
        {enginesData?.uptime_secs != null && (
          <div className="flex items-center justify-between mt-3">
            <span className="font-mono text-[10px] text-ink/30">
              Uptime: {formatUptime(enginesData.uptime_secs)}
            </span>
            <span className="font-mono text-[10px] text-ink/30">
              Seed v{threatData?.stats?.version ?? 0} | {totalEntries} entries |{" "}
              {threatData?.immune_protocols ?? 9} immune protocols
            </span>
          </div>
        )}
      </div>

      {/* ── Section 2: 7-Engine Status Grid ──────────────────── */}
      <div className="card">
        <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">
          Firewall Engines
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-l border-ink/20">
          {engines.map((eng) => (
            <div
              key={eng.id}
              className={`border-r border-b border-ink/20 p-4 ${
                eng.enabled ? "bg-paper" : "bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase">
                  [ Engine_{String(eng.id).padStart(2, "0")} ]
                </span>
                {eng.enabled ? (
                  <span className="badge-active">ON</span>
                ) : (
                  <span className="badge-inactive">OFF</span>
                )}
              </div>
              <div className="font-serif text-lg mb-1">{eng.name}</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink/60">
                  {eng.entries != null
                    ? `${eng.entries} entries`
                    : eng.gtv_enabled
                    ? "GTV active"
                    : eng.fail_closed != null
                    ? eng.fail_closed
                      ? "Fail-closed"
                      : "Fail-open"
                    : "Active"}
                </span>
                {eng.blocks > 0 && (
                  <span className="font-mono text-xs text-terracotta font-bold">
                    {eng.blocks} blocked
                  </span>
                )}
              </div>
            </div>
          ))}
          {/* Whitelist Gate (bonus engine) */}
          <div className="border-r border-b border-ink/20 p-4 bg-paper">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase">
                [ Gate ]
              </span>
              <span className="badge-active">ON</span>
            </div>
            <div className="font-serif text-lg mb-1">Whitelist Gate</div>
            <span className="font-mono text-xs text-ink/60">
              On-chain destination filter
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 3: Active Defenses ───────────────────────── */}
      {features && (
        <div className="card">
          <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">
            Active Defenses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-ink/20">
            <DefenseCard
              label="Cognitive Sever"
              active={features.cognitive_sever}
              detail={features.cognitive_sever_config}
            />
            <DefenseCard
              label="Paymaster Slashing"
              active={features.paymaster_defense}
              detail={features.paymaster_config}
            />
            <DefenseCard
              label="GTV Ratio Cap"
              active={features.gtv_ratio}
              detail={`Max ratio: ${features.gtv_max_ratio}x`}
            />
            <DefenseCard
              label="Gas Anomaly"
              active={features.gas_anomaly}
              detail={`Threshold: ${features.gas_anomaly_ratio}x`}
            />
            <DefenseCard
              label="PVG Ceiling"
              active={features.pvg_ceiling}
              detail={`Max: ${features.pvg_max?.toLocaleString()}`}
            />
            <DefenseCard
              label="Chain ID Lock"
              active={features.chain_id > 0}
              detail={`Base (${features.chain_id})`}
            />
          </div>
        </div>
      )}

      {/* ── Section 4: Recent Block Events ───────────────────── */}
      {recentBlocks.length > 0 && (
        <div className="card">
          <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">
            Recent Block Events
          </h3>
          <div className="max-h-64 overflow-y-auto border border-ink/20">
            {recentBlocks
              .slice()
              .reverse()
              .map((evt, i) => (
                <div
                  key={i}
                  className={`border-b border-ink/10 p-3 ${
                    evt.engine === "ThreatFeed"
                      ? "bg-terracotta/5"
                      : "bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-mono text-[10px] tracking-widest uppercase ${
                        evt.engine === "ThreatFeed"
                          ? "text-terracotta"
                          : "text-ink/60"
                      }`}
                    >
                      [ {evt.engine} ]
                    </span>
                    <span className="font-mono text-[10px] text-ink/30">
                      {formatTimestamp(evt.timestamp)}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-ink/80 leading-relaxed">
                    {evt.reason}
                  </p>
                  {evt.target && (
                    <p className="font-mono text-[10px] text-ink/30 mt-1 truncate">
                      Target: {evt.target}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function DefenseCard({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div
      className={`border-r border-b border-ink/20 p-4 ${
        active ? "bg-paper" : "bg-surface"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-ink">{label}</span>
        {active ? (
          <span className="badge-active">ON</span>
        ) : (
          <span className="badge-inactive">OFF</span>
        )}
      </div>
      <span className="font-mono text-[10px] text-ink/40">{detail}</span>
    </div>
  );
}
