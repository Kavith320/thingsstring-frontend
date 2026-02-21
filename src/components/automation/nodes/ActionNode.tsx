"use client";

import { useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Zap, Cpu, ChevronDown, Power } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ActionNode({ id, data }: { id: string, data: any }) {
    const { updateNodeData } = useReactFlow();
    const options = data.options || [];
    // Unified check for "on" state
    const isNodeEnabled = (val: any) => val === true || val === 1 || val === "ON" || val === "true";

    // Initialize state from data
    const [currentKey, setCurrentKey] = useState(data.actuatorKey || "");
    const [currentValue, setCurrentValue] = useState(isNodeEnabled(data.setValue));

    // Sync state if data changes from outside (e.g. initial load or parent update)
    useEffect(() => {
        if (data.actuatorKey !== undefined && data.actuatorKey !== currentKey) {
            setCurrentKey(data.actuatorKey);
        }
    }, [data.actuatorKey]);

    useEffect(() => {
        const enabled = isNodeEnabled(data.setValue);
        if (enabled !== currentValue) {
            console.log(`[ActionNode ${id}] Syncing external status:`, data.setValue, "->", enabled);
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
        console.log(`[ActionNode ${id}] Toggling UI to:`, newVal);
        setCurrentValue(newVal);
        // Explicitly update node data in the store
        updateNodeData(id, { setValue: newVal });
    };

    return (
        <div className="px-5 py-5 shadow-2xl rounded-[2.5rem] bg-emerald-600 dark:bg-emerald-600 border-4 border-white dark:border-zinc-800 min-w-[240px] text-white">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5 border-b border-white/20 pb-4">
                <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
                    <Zap className="w-4 h-4 text-emerald-50" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/80 flex items-center gap-2">
                        Execution Target
                        <span className="bg-emerald-700/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-emerald-400/30">
                            {data.deviceId?.slice(-4) || "????"}
                        </span>
                    </div>
                    <div className="text-[13px] font-black truncate pr-1">{data.deviceName || "Actuator Device"}</div>
                </div>
            </div>

            <div className="space-y-5">
                {/* Actuator Picker */}
                <div className="group relative">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200 ml-1">Pin / Actuator</span>
                    <div className="relative mt-2 overflow-hidden rounded-2xl bg-black/10 backdrop-blur-lg border border-white/10 hover:border-white/30 hover:bg-black/20 transition-all shadow-inner">
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-200 pointer-events-none" />
                        <select
                            value={currentKey}
                            onChange={handleKeyChange}
                            className="w-full bg-transparent pl-4 pr-10 py-3.5 text-xs font-bold outline-none cursor-pointer appearance-none text-white placeholder-emerald-100"
                        >
                            <option value="" className="text-zinc-900">Choose Output</option>
                            {options.map((opt: string) => (
                                <option key={opt} value={opt} className="text-zinc-900">{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Command Toggle Switch */}
                <div className="flex items-center justify-between gap-4 bg-black/10 p-3 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Command</span>
                        <span className={cn(
                            "text-[9px] font-bold uppercase transition-colors",
                            currentValue ? "text-emerald-50" : "text-emerald-300/50"
                        )}>
                            {currentValue ? "Switch On" : "Switch Off"}
                        </span>
                    </div>

                    <button
                        onClick={toggleValue}
                        type="button"
                        className={cn(
                            "relative inline-flex h-7 w-13 items-center rounded-full transition-all duration-300 focus:outline-none",
                            currentValue
                                ? "bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                : "bg-emerald-950/40 border border-white/10"
                        )}
                    >
                        <span
                            className={cn(
                                "flex items-center justify-center h-5 w-5 rounded-full transition-all duration-300 shadow-md",
                                currentValue
                                    ? "translate-x-7 bg-emerald-600"
                                    : "translate-x-1 bg-white/60"
                            )}
                        >
                            <Power className={cn("w-2.5 h-2.5", currentValue ? "text-white" : "text-emerald-900/60")} />
                        </span>
                    </button>
                </div>

                {/* Status Footer */}
                <div className="flex flex-col gap-2.5 px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200/60 italic">
                        <Cpu className="w-3 h-3 opacity-50" />
                        {data.deviceId}
                    </div>
                    <div className="text-[9px] font-medium text-emerald-50 bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2 border border-white/5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]",
                            currentValue ? "bg-emerald-300 animate-pulse" : "bg-emerald-800"
                        )} />
                        Target status set to <b>{currentValue ? "ON" : "OFF"}</b>
                    </div>
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="!w-6 !h-6 !bg-emerald-500 !border-[6px] !border-white dark:!border-zinc-800 !-left-3 shadow-lg hover:!scale-110 transition-transform"
            />
        </div>
    );
}
