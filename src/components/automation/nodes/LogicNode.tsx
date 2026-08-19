"use client";

import { useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Filter, Clock, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LogicNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();

  const currentOp = data.condition?.operator || ">";
  const currentVal = data.condition?.value ?? data.deltaThreshold ?? 0;

  const [intervalSec, setIntervalSec] = useState<number>(data.intervalSec ?? 30);
  const [cooldownSec, setCooldownSec] = useState<number>(data.cooldownSec ?? 60);

  useEffect(() => {
    if (data.intervalSec !== undefined && data.intervalSec !== intervalSec) {
      setIntervalSec(data.intervalSec);
    }
  }, [data.intervalSec]);

  useEffect(() => {
    if (data.cooldownSec !== undefined && data.cooldownSec !== cooldownSec) {
      setCooldownSec(data.cooldownSec);
    }
  }, [data.cooldownSec]);

  const operators = [
    { label: ">", val: ">" },
    { label: "<", val: "<" },
    { label: "≥", val: ">=" },
    { label: "≤", val: "<=" },
    { label: "==", val: "==" },
    { label: "≠", val: "!=" },
  ];

  const handleOperatorChange = (op: string) => {
    updateNodeData(id, {
      condition: {
        operator: op,
        value: currentVal,
      },
    });
  };

  const handleValueChange = (valStr: string) => {
    const valNum = parseFloat(valStr) || 0;
    updateNodeData(id, {
      condition: {
        operator: currentOp,
        value: valNum,
      },
    });
  };

  const handleIntervalChange = (newVal: number) => {
    const val = Math.max(1, newVal);
    setIntervalSec(val);
    updateNodeData(id, { intervalSec: val });
  };

  const handleCooldownChange = (newVal: number) => {
    const val = Math.max(0, newVal);
    setCooldownSec(val);
    updateNodeData(id, { cooldownSec: val });
  };

  const applyPreset = (iSec: number, cSec: number) => {
    setIntervalSec(iSec);
    setCooldownSec(cSec);
    updateNodeData(id, { intervalSec: iSec, cooldownSec: cSec });
  };

  return (
    <div
      className={cn(
        "px-5 py-5 rounded-[2.2rem] transition-all duration-300 min-w-[270px] text-white shadow-2xl backdrop-blur-xl border-2",
        selected
          ? "bg-amber-600 border-amber-300 ring-4 ring-amber-500/30 scale-105"
          : "bg-amber-600/95 dark:bg-amber-900/90 border-amber-400/40 hover:border-amber-300"
      )}
    >
      {/* Node Type Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/40 border border-amber-300/30 text-[9px] font-extrabold uppercase tracking-widest text-amber-100 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-200" />
          Step 2 • Condition Rule
        </span>
        <span className="text-[10px] font-mono font-bold text-amber-200/90">Rule Filter</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-amber-400/30 pb-3.5">
        <div className="p-2.5 rounded-2xl bg-white/15 shadow-inner backdrop-blur-md">
          <Filter className="w-5 h-5 text-amber-100" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-black truncate leading-snug">Threshold Comparator</div>
          <div className="text-[10px] text-amber-200/80 font-mono mt-0.5">
            Evaluates Telemetry Data
          </div>
        </div>
      </div>

      {/* Operator Button Group */}
      <div className="space-y-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-200/90 block pl-1 mb-1.5">
            Operator
          </span>
          <div className="grid grid-cols-6 gap-1 bg-black/25 p-1 rounded-2xl border border-white/15">
            {operators.map((op) => (
              <button
                key={op.val}
                type="button"
                onClick={() => handleOperatorChange(op.val)}
                className={cn(
                  "py-1.5 rounded-xl text-xs font-black transition-all",
                  currentOp === op.val
                    ? "bg-white text-amber-950 shadow-md font-extrabold scale-105"
                    : "text-amber-100 hover:bg-white/10"
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold Input */}
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-200/90 block pl-1 mb-1">
            Threshold Value
          </span>
          <input
            type="number"
            value={currentVal}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="0"
            className="w-full bg-black/25 border border-white/20 rounded-2xl px-3.5 py-2.5 text-xs font-bold font-mono outline-none text-white focus:border-white/50 transition-all shadow-inner"
          />
        </div>

        {/* Dynamic Timing Settings */}
        <div className="space-y-2 pt-2.5 border-t border-amber-400/30">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-200/90 pl-1">
              Dynamic Timing (Seconds)
            </span>
            {/* Speed Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset(5, 10)}
                className="px-1.5 py-0.5 rounded bg-black/20 text-[8px] font-bold text-amber-200 hover:bg-white hover:text-amber-950 transition"
                title="Fast: 5s check / 10s cooldown"
              >
                ⚡ Fast
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30, 60)}
                className="px-1.5 py-0.5 rounded bg-black/20 text-[8px] font-bold text-amber-200 hover:bg-white hover:text-amber-950 transition"
                title="Normal: 30s check / 60s cooldown"
              >
                ⏱️ Normal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-200/80 flex items-center gap-1 mb-1">
                <Clock className="w-2.5 h-2.5 opacity-80" />
                Check (s)
              </span>
              <input
                type="number"
                value={intervalSec}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                className="w-full bg-black/25 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none text-white focus:border-white/50 transition-all shadow-inner"
              />
            </div>

            <div>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-200/80 flex items-center gap-1 mb-1">
                <Zap className="w-2.5 h-2.5 opacity-80" />
                Cooldown (s)
              </span>
              <input
                type="number"
                value={cooldownSec}
                onChange={(e) => handleCooldownChange(parseInt(e.target.value) || 0)}
                className="w-full bg-black/25 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none text-white focus:border-white/50 transition-all shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Human Readable Badge */}
        <div className="px-3 py-2 rounded-xl bg-white/15 border border-white/20 text-[10px] font-mono text-amber-100 flex items-center justify-between">
          <span className="opacity-80">Trigger IF:</span>
          <span className="font-bold text-white bg-amber-500/50 px-2 py-0.5 rounded-md border border-amber-300/30">
            value {currentOp} {currentVal} ({intervalSec}s / {cooldownSec}s)
          </span>
        </div>
      </div>

      {/* Target & Source Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-amber-400 !border-4 !border-white !-left-2.5 shadow-lg hover:!scale-125 transition-transform cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-amber-400 !border-4 !border-white !-right-2.5 shadow-lg hover:!scale-125 transition-transform cursor-crosshair"
      />
    </div>
  );
}
