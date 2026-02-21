"use client";

import { type Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

interface Props {
  velocityAddr?: Address;
  whitelistAddr?: Address;
  drawdownAddr?: Address;
}

export function ModuleStatus({
  velocityAddr,
  whitelistAddr,
  drawdownAddr,
}: Props) {
  const modules = [
    {
      name: "Velocity Limit",
      description: "Enforces maximum spend rate per rolling hour",
      label: "Engine_02",
      address: velocityAddr,
    },
    {
      name: "Target Whitelist",
      description: "Only allows pre-approved destination contracts",
      label: "Engine_04",
      address: whitelistAddr,
    },
    {
      name: "Drawdown Guard",
      description: "Prevents portfolio drawdown beyond configured floor",
      label: "Engine_06",
      address: drawdownAddr,
    },
  ];

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-ink/60 mb-4 tracking-widest uppercase">Physics Modules</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-l border-ink/20">
        {modules.map((mod) => {
          const isActive = mod.address && mod.address !== ZERO;
          return (
            <div
              key={mod.name}
              className={`border-r border-b border-ink/20 p-4 ${
                isActive ? "bg-paper" : "bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-terracotta tracking-widest uppercase">[ {mod.label} ]</span>
                {isActive ? (
                  <span className="badge-active">ON</span>
                ) : (
                  <span className="badge-inactive">OFF</span>
                )}
              </div>
              <div className="font-serif text-lg mb-1">{mod.name}</div>
              <p className="font-mono text-xs text-ink/60">{mod.description}</p>
              {isActive && (
                <p className="font-mono text-[10px] text-ink/40 mt-2 truncate">
                  {mod.address}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
