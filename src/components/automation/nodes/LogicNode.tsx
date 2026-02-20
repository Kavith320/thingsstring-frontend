"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Filter, Clock, Target, Zap } from "lucide-react";

export default function LogicNode({ id, data }: { id: string, data: any }) {
    const { updateNodeData } = useReactFlow();

    return (
        <div className="px-5 py-4 shadow-2xl rounded-[2rem] bg-amber-500 dark:bg-amber-500 border-4 border-white dark:border-zinc-800 min-w-[200px] text-white">
            <div className="flex items-center gap-3 mb-4 border-b border-white/20 pb-3">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    <Filter className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">Flow Logic</div>
                    <div className="text-sm font-black">Delta Filter</div>
                </div>
            </div>

            <div className="space-y-4 px-1">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Target className="w-3 h-3" />
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
                            className="bg-white/10 border border-white/20 rounded-xl px-2 py-2 text-xs font-black outline-none focus:bg-white/20 transition-all appearance-none text-center"
                        >
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&ge;</option>
                            <option value="<=">&le;</option>
                            <option value="==">==</option>
                            <option value="!=">!=</option>
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
                            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-black outline-none focus:bg-white/20 transition-all font-mono min-w-0"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        Interval (sec)
                    </div>
                    <input
                        type="number"
                        defaultValue={data.intervalSec}
                        onChange={e => updateNodeData(id, { intervalSec: parseInt(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-black outline-none focus:bg-white/20 transition-all font-mono"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-100 uppercase tracking-widest">
                        <Zap className="w-3 h-3" />
                        Cooldown (sec)
                    </div>
                    <input
                        type="number"
                        defaultValue={data.cooldownSec || 60}
                        onChange={e => updateNodeData(id, { cooldownSec: parseInt(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-black outline-none focus:bg-white/20 transition-all font-mono"
                    />
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="!w-6 !h-6 !bg-zinc-200 !border-[6px] !border-amber-500 !-left-3 shadow-lg"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-6 !h-6 !bg-white !border-[6px] !border-amber-500 !-right-3 shadow-lg"
            />
        </div>
    );
}
