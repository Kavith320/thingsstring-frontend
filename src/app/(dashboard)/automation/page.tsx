"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
    Zap,
    Plus,
    Play,
    Pause,
    Settings2,
    Trash2,
    History,
    AlertCircle,
    Activity,
    Cpu,
    CheckCircle2,
    XCircle,
    Clock
} from "lucide-react";
import LoadingSignal from "@/components/LoadingSignal";
import { cn } from "@/lib/utils";
import AutomationModal from "@/components/automation/AutomationModal";
import FlowLogsModal from "@/components/automation/FlowLogsModal";

export interface AutomationFlow {
    _id: string;
    name: string;
    deviceId: string;
    enabled: boolean;
    intervalSec: number;
    metricPath: string;
    deltaThreshold: number;
    action: {
        actuatorKey: string;
        setValue: boolean | number;
    };
    cooldownSec: number;
    createdAt: string;
    updatedAt: string;
}

export default function AutomationPage() {
    const [flows, setFlows] = useState<AutomationFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
    const [logsFlowId, setLogsFlowId] = useState<string | null>(null);

    async function loadFlows() {
        try {
            const data = await apiRequest("/api/automation/flows");
            setFlows(data.flows || []);
        } catch (e: any) {
            setError(e.message || "Failed to load automation flows");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadFlows();
    }, []);

    async function toggleFlow(flow: AutomationFlow) {
        try {
            await apiRequest(`/api/automation/flows/${flow._id}`, {
                method: "PUT",
                body: { enabled: !flow.enabled }
            });
            loadFlows();
        } catch (e: any) {
            alert(e.message || "Failed to update flow");
        }
    }

    async function deleteFlow(id: string) {
        if (!confirm("Are you sure you want to delete this automation?")) return;
        try {
            await apiRequest(`/api/automation/flows/${id}`, {
                method: "DELETE"
            });
            loadFlows();
        } catch (e: any) {
            alert(e.message || "Failed to delete flow");
        }
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Zap className="w-8 h-8 text-indigo-500" />
                        Automation Engine
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Connect telemetry thresholds to device actions
                    </p>
                </div>

                <button
                    onClick={() => {
                        setEditingFlow(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-2xl font-semibold shadow-lg shadow-zinc-900/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Create Automation
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <LoadingSignal size="lg" />
                    <p className="mt-4 text-zinc-500 animate-pulse">Waking up the engine...</p>
                </div>
            ) : flows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6">
                        <Zap className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No automations yet</h3>
                    <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto text-balance">
                        Automations let you trigger device actions based on sensor changes.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {flows.map((flow) => (
                        <div
                            key={flow._id}
                            className="group relative flex flex-col rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40 p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 backdrop-blur-xl overflow-hidden"
                        >
                            {/* Status Glow */}
                            {flow.enabled && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            )}

                            <div className="flex items-start justify-between mb-6">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate pr-2">
                                        {flow.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Cpu className="w-3 h-3 text-zinc-400" />
                                        <span className="text-xs font-mono text-zinc-500 uppercase tracking-tight">{flow.deviceId}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleFlow(flow)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide transition-all border",
                                        flow.enabled
                                            ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20"
                                            : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
                                    )}
                                >
                                    {flow.enabled ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                                    {flow.enabled ? "ACTIVE" : "PAUSED"}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Trigger</div>
                                    <div className="text-sm font-bold flex items-center gap-1.5 dark:text-zinc-200">
                                        <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                        {flow.metricPath} Δ{flow.deltaThreshold}
                                    </div>
                                </div>
                                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                                    <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Interval</div>
                                    <div className="text-sm font-bold flex items-center gap-1.5 dark:text-zinc-200">
                                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                        {flow.intervalSec}s
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-6">
                                <div className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2 font-bold">Target Action</div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium dark:text-zinc-300">{flow.action.actuatorKey}</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-lg text-[10px] font-bold",
                                        flow.action.setValue === true || flow.action.setValue === "ON" || flow.action.setValue === 1
                                            ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                            : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                    )}>
                                        SET {String(flow.action.setValue).toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setLogsFlowId(flow._id)}
                                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
                                        title="View History"
                                    >
                                        <History className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingFlow(flow);
                                            setIsModalOpen(true);
                                        }}
                                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
                                        title="Edit Flow"
                                    >
                                        <Settings2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => deleteFlow(flow._id)}
                                    className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                                    title="Delete Flow"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            {isModalOpen && (
                <AutomationModal
                    flow={editingFlow}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => {
                        setIsModalOpen(false);
                        loadFlows();
                    }}
                />
            )}

            {logsFlowId && (
                <FlowLogsModal
                    flowId={logsFlowId}
                    onClose={() => setLogsFlowId(null)}
                />
            )}
        </div>
    );
}
