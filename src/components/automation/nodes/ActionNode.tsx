"use client";

import { useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Zap, Cpu, ChevronDown, Power, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ActionNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const options = data.options || [];
  const isNodeEnabled = (val: any) =>
    val === true || val === 1 || val === "ON" || val === "true";

  const [currentKey, setCurrentKey] = useState(data.actuatorKey || "");
  const [currentValue, setCurrentValue] = useState(isNodeEnabled(data.setValue));

  useEffect(() => {
    if (data.actuatorKey !== undefined && data.actuatorKey !== currentKey) {
      setCurrentKey(data.actuatorKey);
    }
  }, [data.actuatorKey]);

  useEffect(() => {
    const enabled = isNodeEnabled(data.setValue);
    if (enabled !== currentValue) {
      setCurrentValue(enabled);
    }
  }, [data.setValue]);

  const handleKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrentKey(val);
    updateNodeData(id, { actuatorKey: val });
  };

  const toggleValue = () => {
    const newVal = !currentValue;
    setCurrentValue(newVal);
    updateNodeData(id, { setValue: newVal });
  };

  return (
    <div
      className={cn(
        "px-5 py-5 rounded-[2.2rem] transition-all duration-300 min-w-[250px] text-white shadow-2xl backdrop-blur-xl border-2",
        selected
          ? "bg-emerald-600 border-emerald-300 ring-4 ring-emerald-500/30 scale-105"
          : "bg-emerald-600/95 dark:bg-emerald-900/90 border-emerald-400/40 hover:border-emerald-300"
      )}
    >
      {/* Node Type Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/40 border border-emerald-300/30 text-[9px] font-extrabold uppercase tracking-widest text-emerald-100 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-emerald-200" />
          Step 3 • Action Output
        </span>
        <span className="text-[10px] font-mono font-bold text-emerald-200/90">Execution</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-emerald-400/30 pb-3.5">
        <div className="p-2.5 rounded-2xl bg-white/15 shadow-inner backdrop-blur-md">
          <Zap className="w-5 h-5 text-emerald-100" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-black truncate leading-snug">
            {data.deviceName || "Actuator Device"}
          </div>
          <div className="text-[10px] text-emerald-200/80 font-mono flex items-center gap-1 mt-0.5">
            <Cpu className="w-3 h-3 opacity-70" />
            <span>ID: {data.deviceId?.slice(-6) || "????"}</span>
          </div>
        </div>
      </div>

      {/* Actuator Key Selector */}
      <div className="space-y-3">
        <div>
          <label className="text-[9px] font-black uppercase tracking-wider text-emerald-200/90 block pl-1 mb-1">
            Output Actuator / Relay
          </label>
          <div className="relative overflow-hidden rounded-2xl bg-black/25 border border-white/20 hover:border-white/40 transition-all shadow-inner">
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200 pointer-events-none" />
            <select
              value={currentKey}
              onChange={handleKeyChange}
              className="w-full bg-transparent pl-3.5 pr-9 py-2.5 text-xs font-bold outline-none cursor-pointer appearance-none text-white"
            >
              <option value="" className="text-zinc-900">
                Select Output Pin...
              </option>
              {options.map((opt: string) => (
                <option key={opt} value={opt} className="text-zinc-900">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Command LED Toggle Switch */}
        <div className="flex items-center justify-between gap-3 bg-black/25 p-3 rounded-2xl border border-white/15">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200/80">
              Command State
            </span>
            <span
              className={cn(
                "text-xs font-black uppercase tracking-wider",
                currentValue ? "text-emerald-300" : "text-zinc-300 opacity-60"
              )}
            >
              {currentValue ? "SET TO ON" : "SET TO OFF"}
            </span>
          </div>

          <button
            onClick={toggleValue}
            type="button"
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner",
              currentValue
                ? "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                : "bg-zinc-800 border border-white/20"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded-full transition-all duration-300 shadow-md",
                currentValue
                  ? "translate-x-6 bg-white text-emerald-600 font-bold"
                  : "translate-x-1 bg-zinc-400 text-zinc-800"
              )}
            >
              <Power className="w-2.5 h-2.5" />
            </span>
          </button>
        </div>

        {/* Human Readable Outcome Badge */}
        <div className="px-3 py-2 rounded-xl bg-white/15 border border-white/20 text-[10px] font-mono text-emerald-100 flex items-center justify-between">
          <span className="opacity-80">Execution Outcome:</span>
          <span className="font-bold text-white bg-emerald-500/50 px-2 py-0.5 rounded-md border border-emerald-300/30">
            {currentKey || "Pin"} ➔ {currentValue ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Target Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-emerald-400 !border-4 !border-white !-left-2.5 shadow-lg hover:!scale-125 transition-transform cursor-crosshair"
      />
    </div>
  );
}
