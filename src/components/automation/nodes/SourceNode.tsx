"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Activity, Cpu, ChevronDown, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SourceNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const options = data.options || [];
  const [currentPath, setCurrentPath] = useState(data.metricPath || "");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrentPath(val);
    updateNodeData(id, { metricPath: val });
  };

  return (
    <div
      className={cn(
        "px-5 py-5 rounded-[2.2rem] transition-all duration-300 min-w-[240px] text-white shadow-2xl backdrop-blur-xl border-2",
        selected
          ? "bg-indigo-600 border-indigo-300 ring-4 ring-indigo-500/30 scale-105"
          : "bg-indigo-600/95 dark:bg-indigo-900/90 border-indigo-400/40 hover:border-indigo-300"
      )}
    >
      {/* Node Type Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/40 border border-indigo-300/30 text-[9px] font-extrabold uppercase tracking-widest text-indigo-100 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-indigo-200" />
          Step 1 • Sensor Input
        </span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-indigo-400/30 pb-3.5">
        <div className="p-2.5 rounded-2xl bg-white/15 shadow-inner backdrop-blur-md">
          <Radio className="w-5 h-5 text-indigo-100 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-black truncate leading-snug">
            {data.name || "Sensor Device"}
          </div>
          <div className="text-[10px] text-indigo-200/80 font-mono flex items-center gap-1 mt-0.5">
            <Cpu className="w-3 h-3 opacity-70" />
            <span>ID: {data.deviceId?.slice(-6) || "????"}</span>
          </div>
        </div>
      </div>

      {/* Selector */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-wider text-indigo-200/90 block pl-1">
          Target Sensor Metric
        </label>
        <div className="relative overflow-hidden rounded-2xl bg-black/25 border border-white/20 hover:border-white/40 transition-all shadow-inner">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-200 pointer-events-none" />
          <select
            value={currentPath}
            onChange={handleChange}
            className="w-full bg-transparent pl-3.5 pr-9 py-2.5 text-xs font-bold outline-none cursor-pointer appearance-none text-white"
          >
            <option value="" className="text-zinc-900">
              Select Measurement...
            </option>
            {options.map((opt: string) => (
              <option key={opt} value={opt} className="text-zinc-900">
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Selected Metric Indicator */}
      {currentPath && (
        <div className="mt-3 px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 text-[10px] font-mono text-indigo-100 flex items-center justify-between">
          <span className="opacity-80">Listening for:</span>
          <span className="font-bold text-white bg-indigo-500/50 px-2 py-0.5 rounded-md border border-indigo-300/30">
            {currentPath}
          </span>
        </div>
      )}

      {/* Source Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-indigo-400 !border-4 !border-white !-right-2.5 shadow-lg hover:!scale-125 transition-transform cursor-crosshair"
      />
    </div>
  );
}
