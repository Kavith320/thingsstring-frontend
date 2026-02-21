"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Filter, Clock, Target, Zap } from "lucide-react";

export default function LogicNode({ id, data }: { id: string, data: any }) {
    const { updateNodeData } = useReactFlow();

    return (
        <div className="px-5 py-5 shadow-2xl rounded-[2.5rem] bg-amber-500 dark:bg-amber-500 border-4 border-white dark:border-zinc-800 min-w-[220px] text-white">
            <div className="flex items-center gap-3 mb-5 border-b border-white/20 pb-4">
                <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
                    <Filter className="w-4 h-4 text-amber-50" />
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/80">Flow Logic</div>
                    <div className="text-[13px] font-black">Delta Filter</div>
                </div>
            </div>

            <div className="space-y-5 px-1">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Target className="w-3 h-3 opacity-70" />
                        Trigger Condition
                    </div>
                    <div className="flex gap-2">
                        <select
                            defaultValue={data.condition?.operator || ">"}
                            onChange={e => updateNodeData(id, {
                                condition: {
                                    ...data.condition,
                                    operator: e.target.value,
                                    value: data.condition?.value ?? 0
                                }
                            })}
                            className="bg-black/10 border border-white/10 rounded-xl px-2 py-2.5 text-xs font-black outline-none focus:bg-black/20 transition-all appearance-none text-center min-w-[50px] text-white"
                        >
                            <option value=">" className="text-zinc-900">&gt;</option>
                            <option value="<" className="text-zinc-900">&lt;</option>
                            <option value=">=" className="text-zinc-900">&ge;</option>
                            <option value="<=" className="text-zinc-900">&le;</option>
                            <option value="==" className="text-zinc-900">==</option>
                            <option value="!=" className="text-zinc-900">!=</option>
                        </select>
                        <input
                            type="number"
                            placeholder="Value"
                            defaultValue={data.condition?.value ?? data.deltaThreshold}
                            onChange={e => updateNodeData(id, {
                                condition: {
                                    operator: data.condition?.operator || ">",
                                    value: parseFloat(e.target.value)
                                }
                            })}
                            className="flex-1 bg-black/10 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-black outline-none focus:bg-black/20 transition-all font-mono min-w-0 text-white placeholder-amber-200/50 shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Clock className="w-3 h-3 opacity-70" />
                        Check Interval (s)
                    </div>
                    <input
                        type="number"
                        defaultValue={data.intervalSec}
                        onChange={e => updateNodeData(id, { intervalSec: parseInt(e.target.value) })}
                        className="w-full bg-black/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black outline-none focus:bg-black/20 transition-all font-mono text-white shadow-inner"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Zap className="w-3 h-3 opacity-70" />
                        Execution Cooldown (s)
                    </div>
                    <input
                        type="number"
                        defaultValue={data.cooldownSec || 60}
                        onChange={e => updateNodeData(id, { cooldownSec: parseInt(e.target.value) })}
                        className="w-full bg-black/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black outline-none focus:bg-black/20 transition-all font-mono text-white shadow-inner"
                    />
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="!w-6 !h-6 !bg-white !border-[6px] !border-amber-500 !-left-3 shadow-lg hover:!scale-110 transition-transform"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-6 !h-6 !bg-white !border-[6px] !border-amber-500 !-right-3 shadow-lg hover:!scale-110 transition-transform"
            />
        </div>
    );
}
