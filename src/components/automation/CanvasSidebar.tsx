"use client";

import React, { useState } from "react";
import { Activity, Zap, Filter, Cpu, Database, MousePointer2, ChevronLeft, ChevronRight, LayoutPanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/types/automation";

interface CanvasSidebarProps {
    devices: Device[];
}

export default function CanvasSidebar({ devices }: CanvasSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const onDragStart = (event: React.DragEvent, nodeType: string, data: any) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.setData("application/reactflow-data", JSON.stringify(data));
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className={cn(
            "h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 relative group",
            isCollapsed ? "w-16 p-3" : "w-64 p-4"
        )}>
            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-10 w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-500 hover:text-white transition-all z-20"
            >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className={cn("overflow-y-auto custom-scrollbar flex-1", isCollapsed ? "overflow-x-hidden" : "")}>
                <div className={cn("mb-10 transition-opacity duration-200", isCollapsed ? "opacity-0 invisible h-0" : "opacity-100")}>
                    <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-4">Automation Assets</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed text-balance">
                        Drag nodes to the canvas to define your flow.
                    </p>
                </div>

                {isCollapsed && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <LayoutPanelLeft className="w-5 h-5 text-zinc-400 mb-4" />
                        <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                )}

                <div className="space-y-6">
                    {/* Logic Blocks */}
                    <section>
                        <div className={cn("flex items-center justify-between mb-3", isCollapsed ? "justify-center" : "")}>
                            <h4 className={cn("text-[10px] font-black text-amber-500 uppercase tracking-widest transition-all flex items-center gap-1", isCollapsed ? "scale-0 h-0 w-0 overflow-hidden" : "")}>
                                🟡 Step 2 • Logic Filter
                            </h4>
                            <Filter className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div
                            className={cn(
                                "group flex items-center justify-center rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 cursor-grab hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/20 transition-all",
                                isCollapsed ? "p-3" : "p-3.5 gap-3"
                            )}
                            draggable
                            onDragStart={(e) => onDragStart(e, "logic", { condition: { operator: ">", value: 30 }, deltaThreshold: 1.0, intervalSec: 30, cooldownSec: 60 })}
                            title={isCollapsed ? "Threshold Filter" : ""}
                        >
                            <div className={cn(
                                "rounded-xl bg-amber-500 text-white shadow-md group-hover:scale-110 transition-transform",
                                isCollapsed ? "p-1.5" : "p-2.5"
                            )}>
                                <Filter className={isCollapsed ? "w-4 h-4" : "w-4 h-4"} />
                            </div>
                            {!isCollapsed && (
                                <div className="min-w-0">
                                    <div className="text-xs font-black dark:text-white">Threshold Comparator</div>
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">IF telemetry &gt; X</div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Devices Section */}
                    <section>
                        <div className={cn("flex items-center justify-between mb-4", isCollapsed ? "justify-center" : "")}>
                            <h4 className={cn("text-[10px] font-black text-zinc-400 uppercase tracking-widest transition-all", isCollapsed ? "scale-0 h-0 w-0 overflow-hidden" : "")}>Hardware</h4>
                            <Cpu className="w-3.5 h-3.5 text-zinc-300" />
                        </div>

                        <div className="space-y-4">
                            {devices.map(device => {
                                const telemetryKeys = device.last_telemetry
                                    ? Object.keys(device.last_telemetry).filter(k => !['_id', 'ts', 'timestamp', 'updatedAt', 'createdAt', '__v', 'actuators'].includes(k))
                                    : [];
                                const actuators = device.config?.actuators ? Object.keys(device.config.actuators) : [];

                                if (telemetryKeys.length === 0 && actuators.length === 0) return null;

                                const displayName =
                                    device.config?.device?.name ||
                                    device.config?.device?.model ||
                                    device.name ||
                                    device.deviceId ||
                                    "Unnamed Device";

                                return (
                                    <div key={device.deviceId} className={cn(
                                        "flex flex-col rounded-3xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/40 transition-all",
                                        isCollapsed ? "p-2 gap-2" : "p-4 space-y-3"
                                    )}>
                                        {!isCollapsed && (
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                                    <Cpu className="w-4 h-4 text-zinc-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black dark:text-white truncate">{displayName}</div>
                                                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{device.deviceId}</div>
                                                </div>
                                            </div>
                                        )}

                                        <div className={cn("grid grid-cols-1 gap-2", isCollapsed ? "place-items-center" : "")}>
                                            {/* Drag Sensor Node */}
                                            {telemetryKeys.length > 0 && (
                                                <div
                                                    className={cn(
                                                        "group flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-grab hover:border-indigo-500/40 hover:shadow-lg transition-all",
                                                        isCollapsed ? "p-2.5" : "p-2.5 gap-3"
                                                    )}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, "source", {
                                                        name: device.name,
                                                        deviceId: device.deviceId,
                                                        options: telemetryKeys,
                                                        metricPath: telemetryKeys[0]
                                                    })}
                                                    title={isCollapsed ? `${device.name} Sensor Hub` : ""}
                                                >
                                                    <div className={cn(
                                                        "rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all",
                                                        isCollapsed ? "p-1.5" : "p-2"
                                                    )}>
                                                        <Activity className={isCollapsed ? "w-3.5 h-3.5" : "w-4 h-4"} />
                                                    </div>
                                                    {!isCollapsed && (
                                                        <div className="flex flex-col min-w-0 text-left">
                                                            <span className="text-[10px] font-bold dark:text-zinc-300 truncate">{device.name || "Device"} Sensor</span>
                                                            <span className="text-[8px] font-extrabold text-indigo-500 uppercase tracking-widest">🔵 Step 1 • Input</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Drag Actuator Node */}
                                            {actuators.length > 0 && (
                                                <div
                                                    className={cn(
                                                        "group flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-grab hover:border-emerald-500/40 hover:shadow-lg transition-all",
                                                        isCollapsed ? "p-2.5" : "p-2.5 gap-3"
                                                    )}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, "action", {
                                                        deviceName: device.name,
                                                        deviceId: device.deviceId,
                                                        options: actuators,
                                                        actuatorKey: actuators[0],
                                                        setValue: true
                                                    })}
                                                    title={isCollapsed ? `${device.name} Actuator Controller` : ""}
                                                >
                                                    <div className={cn(
                                                        "rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all",
                                                        isCollapsed ? "p-1.5" : "p-2"
                                                    )}>
                                                        <Zap className={isCollapsed ? "w-3.5 h-3.5" : "w-4 h-4"} />
                                                    </div>
                                                    {!isCollapsed && (
                                                        <div className="flex flex-col min-w-0 text-left">
                                                            <span className="text-[10px] font-bold dark:text-zinc-300 truncate">{device.name || "Device"} Actuator</span>
                                                            <span className="text-[8px] font-extrabold text-emerald-500 uppercase tracking-widest">🟢 Step 3 • Output</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
