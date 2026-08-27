"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { X, CheckCircle2, XCircle, AlertCircle, Clock, ArrowDown, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowLog {
    _id: string;
    flowId: string;
    ts: string;
    status: "ran" | "skipped" | "error";
    reason?: string;
    currentValue: number;
    previousValue: number;
    delta: number;
    action?: any;
}

interface FlowLogsModalProps {
    flowId: string;
    onClose: () => void;
}

export default function FlowLogsModal({ flowId, onClose }: FlowLogsModalProps) {
    const [logs, setLogs] = useState<FlowLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadLogs() {
            try {
                const data = await apiRequest(`/api/automation/flows/${flowId}/logs?limit=30`);
                setLogs(data.logs || []);
            } catch (e: any) {
                setError(e.message || "Failed to load logs");
            } finally {
                setLoading(false);
            }
        }
        loadLogs();
    }, [flowId]);

    const formatTime = (ts: string) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (ts: string) => {
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                            <History className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold dark:text-white">Execution History</h3>
                            <p className="text-sm text-zinc-500">Recent automation activities</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="mt-4 text-sm text-zinc-500">Fetching logs...</p>
                        </div>
                    ) : error ? (
                        <div className="p-10 text-center">
                            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                            <p className="text-zinc-900 dark:text-white font-bold">{error}</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-20 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                            </div>
                            <p className="text-zinc-500 text-sm">No activity logs found yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {logs.map((log) => (
                                <div key={log._id} className="p-4 sm:p-6 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3">
                                            {log.status === "ran" && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                                            {log.status === "skipped" && <Clock className="w-5 h-5 text-zinc-400 shrink-0" />}
                                            {log.status === "error" && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}

                                            <div>
                                                <div className="text-sm font-bold dark:text-zinc-200 flex items-center gap-2">
                                                    {log.status === "ran"
                                                        ? "Action Triggered"
                                                        : log.status === "skipped"
                                                            ? (log.reason?.toLowerCase().includes("offline") ? "Skipped (Device Offline)" : "Condition Not Met")
                                                            : "Execution Error"}
                                                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">
                                                        {formatTime(log.ts)}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-zinc-400 font-medium">
                                                    {formatDate(log.ts)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-xs font-mono dark:text-zinc-400">
                                                {log.previousValue ?? 0} → {log.currentValue ?? 0}
                                            </div>
                                            <div className={cn(
                                                "text-[10px] font-bold",
                                                (log.delta ?? 0) >= 0 ? "text-indigo-500" : "text-amber-500"
                                            )}>
                                                Δ {(log.delta ?? 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    {log.reason && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100/50 dark:bg-white/5 p-2 rounded-lg mt-2 italic flex items-start gap-2">
                                            <Info className="w-3.5 h-3.5 mt-0.5" />
                                            {log.reason}
                                        </p>
                                    )}

                                    {log.action && (
                                        <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                                            <ArrowDown className="w-3 h-3" />
                                            SET {log.action.actuatorKey} = {String(log.action.setValue).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-6 rounded-2xl font-bold text-sm bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xl shadow-zinc-900/10 dark:shadow-white/5 hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                        Close Logs
                    </button>
                </div>
            </div>
        </div>
    );
}

function Info({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
    )
}
