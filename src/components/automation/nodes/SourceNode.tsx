"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Activity, Cpu, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SourceNode({ id, data }: { id: string, data: any }) {
    const { updateNodeData } = useReactFlow();
    const options = data.options || [];
    const [currentPath, setCurrentPath] = useState(data.metricPath || "");

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setCurrentPath(val);
        updateNodeData(id, { metricPath: val });
    };

    return (
        <div className="px-5 py-4 shadow-2xl rounded-[2rem] bg-indigo-600 dark:bg-indigo-600 border-4 border-white dark:border-zinc-800 min-w-[220px] text-white">
            <div className="flex items-center gap-3 mb-4 border-b border-white/20 pb-3">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    <Activity className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200 flex items-center gap-2">
                        Sensor Node
                        <span className="bg-indigo-700/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-indigo-400/30">{data.deviceId}</span>
                    </div>
                    <div className="text-xs font-black truncate pr-1">{data.name || "Sensor Device"}</div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="group relative">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 ml-1">Select Measurement</span>
                    <div className="relative mt-1.5 overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition-all">
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-200 pointer-events-none" />
                        <select
                            value={currentPath}
                            onChange={handleChange}
                            className="w-full bg-transparent pl-4 pr-10 py-3 text-xs font-bold outline-none cursor-pointer appearance-none"
                        >
                            <option value="" className="text-zinc-900">Choose Metric</option>
                            {options.map((opt: string) => (
                                <option key={opt} value={opt} className="text-zinc-900">{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-300/80 px-1 italic">
                    <Cpu className="w-3 h-3" />
                    {data.deviceId}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-6 !h-6 !bg-white !border-[6px] !border-indigo-500 !-right-3 shadow-lg"
            />
        </div>
    );
}
