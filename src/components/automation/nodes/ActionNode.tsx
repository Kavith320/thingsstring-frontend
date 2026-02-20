"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Zap, Cpu, ChevronDown, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ActionNode({ id, data }: { id: string, data: any }) {
    const { updateNodeData } = useReactFlow();
    const options = data.options || [];
    const isEnabled = data.setValue === true || data.setValue === 1 || data.setValue === "ON";

    const [currentKey, setCurrentKey] = useState(data.actuatorKey || "");
    const [currentValue, setCurrentValue] = useState(isEnabled);

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
        <div className="px-5 py-4 shadow-2xl rounded-[2rem] bg-emerald-600 dark:bg-emerald-600 border-4 border-white dark:border-zinc-800 min-w-[220px] text-white">
            <div className="flex items-center gap-3 mb-4 border-b border-white/20 pb-3">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200 flex items-center gap-2">
                        Execution Target
                        <span className="bg-emerald-700/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-emerald-400/30">{data.deviceId}</span>
                    </div>
                    <div className="text-xs font-black truncate pr-1">{data.deviceName || "Actuator Device"}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="group relative">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 ml-1">Select Actuator</span>
                    <div className="relative mt-1.5 overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition-all">
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-200 pointer-events-none" />
                        <select
                            value={currentKey}
                            onChange={handleKeyChange}
                            className="w-full bg-transparent pl-4 pr-10 py-3 text-xs font-bold outline-none cursor-pointer appearance-none"
                        >
                            <option value="" className="text-zinc-900">Choose Actuator</option>
                            {options.map((opt: string) => (
                                <option key={opt} value={opt} className="text-zinc-900">{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Command</div>
                    <button
                        onClick={toggleValue}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all shadow-lg active:scale-90",
                            currentValue
                                ? "bg-white text-emerald-600"
                                : "bg-black/20 text-white border border-white/20"
                        )}
                    >
                        {currentValue ? "TURN ON" : "TURN OFF"}
                    </button>
                </div>

                <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-300/80 italic">
                        <Cpu className="w-3 h-3" />
                        {data.deviceId}
                    </div>
                    <div className="text-[9px] text-white/50 bg-black/10 rounded-lg px-2 py-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        Ensure actuator is in <b>Auto Mode</b>
                    </div>
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="!w-6 !h-6 !bg-emerald-500 !border-[6px] !border-white dark:!border-zinc-800 !-left-3 shadow-lg"
            />
        </div>
    );
}
