"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { X, Cpu, Activity, Clock, Zap, Target, MousePointer2, Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutomationFlow, Device } from "@/types/automation";

interface AutomationModalProps {
    flow: AutomationFlow | null;
    onClose: () => void;
    onSave: () => void;
}

export default function AutomationModal({ flow, onClose, onSave }: AutomationModalProps) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        deviceId: "", // The sensor device
        intervalSec: 30,
        metricPath: "",
        deltaThreshold: 1.0,
        action: {
            deviceId: "", // The actuator device
            actuatorKey: "",
            setValue: true as boolean | number | string
        },
        cooldownSec: 60
    });

    useEffect(() => {
        if (flow) {
            setFormData({
                name: flow.name,
                deviceId: flow.deviceId,
                intervalSec: flow.intervalSec,
                metricPath: flow.metricPath,
                deltaThreshold: flow.deltaThreshold,
                action: {
                    deviceId: flow.action.deviceId || flow.deviceId, // fallback to same device
                    actuatorKey: flow.action.actuatorKey,
                    setValue: flow.action.setValue
                },
                cooldownSec: flow.cooldownSec
            });
        }
    }, [flow]);

    useEffect(() => {
        async function loadData() {
            try {
                const data = await apiRequest("/api/devices");
                setDevices(Array.isArray(data) ? data : data.devices || []);
            } catch (e) {
                console.error("Failed to load devices", e);
            } finally {
                setLoadingDevices(false);
            }
        }
        loadData();
    }, []);

    const triggerDevice = devices.find(d => d.deviceId === formData.deviceId);
    const actionDevice = devices.find(d => d.deviceId === formData.action.deviceId);

    // Extract keys based on specific device selections
    const actuators = actionDevice?.config?.actuators ? Object.keys(actionDevice.config.actuators) : [];
    const telemetryKeys = triggerDevice?.last_telemetry
        ? Object.keys(triggerDevice.last_telemetry).filter(k => !['_id', 'ts', 'timestamp', 'updatedAt', 'createdAt', '__v', 'actuators'].includes(k))
        : [];

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const endpoint = flow ? `/api/automation/flows/${flow._id}` : "/api/automation/flows";
            const method = flow ? "PUT" : "POST";
            await apiRequest(endpoint, {
                method,
                body: formData
            });
            onSave();
        } catch (e: any) {
            alert(e.message || "Failed to save flow");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xl font-bold dark:text-white">
                            {flow ? "Edit Automation" : "New Automation"}
                        </h3>
                        <p className="text-sm text-zinc-500 font-medium">Create cross-device intelligent flows</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Basic Info */}
                    <section className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Flow Description</span>
                            <input
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Turn on Fan when Temp is high"
                                className="mt-2 w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Check Frequency</span>
                                <div className="relative mt-2">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                    <input
                                        type="number"
                                        min="5"
                                        max="3600"
                                        required
                                        value={formData.intervalSec}
                                        onChange={e => setFormData({ ...formData, intervalSec: parseInt(e.target.value) })}
                                        className="w-full pl-11 pr-12 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">sec</span>
                                </div>
                            </label>

                            <label className="block text-transparent pointer-events-none select-none hidden sm:block">
                                <span className="text-xs font-bold uppercase tracking-widest ml-1">Spacer</span>
                                <div className="mt-2 py-3">.</div>
                            </label>
                        </div>
                    </section>

                    {/* Trigger Config */}
                    <section className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500 text-white">
                                <Activity className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300">1. Trigger Source</h4>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-xs font-bold text-indigo-900/40 dark:text-indigo-300/40 uppercase tracking-widest ml-1">Sensor Device</span>
                                <div className="relative mt-2">
                                    <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <select
                                        required
                                        value={formData.deviceId}
                                        onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-indigo-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
                                    >
                                        <option value="">Select Sensor Device</option>
                                        {devices.map(d => {
                                            const name = d.config?.device?.name || d.config?.device?.model || d.name || d.deviceId || "Unnamed Device";
                                            return (
                                                <option key={d.deviceId} value={d.deviceId}>
                                                    {name} {d.name || d.config?.device?.name ? `(${d.deviceId})` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-xs font-bold text-indigo-900/40 dark:text-indigo-300/40 uppercase tracking-widest ml-1">Metric / Value</span>
                                    <div className="relative mt-2">
                                        <MousePointer2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                        <input
                                            required
                                            value={formData.metricPath}
                                            list="telem-keys"
                                            onChange={e => setFormData({ ...formData, metricPath: e.target.value })}
                                            placeholder="e.g. temp"
                                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-indigo-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                        />
                                        <datalist id="telem-keys">
                                            {telemetryKeys.map(k => <option key={k} value={k} />)}
                                        </datalist>
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-indigo-900/40 dark:text-indigo-300/40 uppercase tracking-widest ml-1">Delta Change</span>
                                    <div className="relative mt-2">
                                        <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={formData.deltaThreshold}
                                            onChange={e => setFormData({ ...formData, deltaThreshold: parseFloat(e.target.value) })}
                                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-indigo-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-center -my-4 relative z-10">
                        <div className="bg-white dark:bg-zinc-950 p-2 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-lg">
                            <ArrowRight className="w-5 h-5 text-zinc-400 rotate-90" />
                        </div>
                    </div>

                    {/* Action Config */}
                    <section className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500 text-white">
                                <Zap className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-emerald-900 dark:text-emerald-300">2. Action Execution</h4>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-xs font-bold text-emerald-900/40 dark:text-emerald-300/40 uppercase tracking-widest ml-1">Actuator Device</span>
                                <div className="relative mt-2">
                                    <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                    <select
                                        required
                                        value={formData.action.deviceId}
                                        onChange={e => setFormData({
                                            ...formData,
                                            action: { ...formData.action, deviceId: e.target.value, actuatorKey: "" }
                                        })}
                                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-emerald-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm appearance-none"
                                    >
                                        <option value="">Select Actuator Device</option>
                                        {devices.map(d => {
                                            const name = d.config?.device?.name || d.config?.device?.model || d.name || d.deviceId || "Unnamed Device";
                                            return (
                                                <option key={d.deviceId} value={d.deviceId}>
                                                    {name} {d.name || d.config?.device?.name ? `(${d.deviceId})` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-xs font-bold text-emerald-900/40 dark:text-emerald-300/40 uppercase tracking-widest ml-1">Actuator</span>
                                    <select
                                        required
                                        value={formData.action.actuatorKey}
                                        disabled={!formData.action.deviceId}
                                        onChange={e => setFormData({ ...formData, action: { ...formData.action, actuatorKey: e.target.value } })}
                                        className="mt-2 w-full px-4 py-3 rounded-2xl border border-emerald-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm disabled:opacity-50 appearance-none"
                                    >
                                        <option value="">Select Actuator</option>
                                        {actuators.map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-emerald-900/40 dark:text-emerald-300/40 uppercase tracking-widest ml-1">Command</span>
                                    <div className="mt-2 flex gap-2 p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-500/10">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, action: { ...formData.action, setValue: true } })}
                                            className={cn(
                                                "flex-1 py-1.5 text-[10px] font-bold rounded-xl transition-all",
                                                (formData.action.setValue === true || formData.action.setValue === 1 || formData.action.setValue === "1" || formData.action.setValue === "ON")
                                                    ? "bg-emerald-500 text-white shadow-lg"
                                                    : "text-zinc-500 hover:text-emerald-600"
                                            )}
                                        >
                                            ON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, action: { ...formData.action, setValue: false } })}
                                            className={cn(
                                                "flex-1 py-1.5 text-[10px] font-bold rounded-xl transition-all",
                                                (formData.action.setValue === false || formData.action.setValue === 0 || formData.action.setValue === "0" || formData.action.setValue === "OFF")
                                                    ? "bg-red-500 text-white shadow-lg"
                                                    : "text-zinc-500 hover:text-red-600"
                                            )}
                                        >
                                            OFF
                                        </button>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-bold text-emerald-900/40 dark:text-emerald-300/40 uppercase tracking-widest ml-1">Run Cooldown</span>
                            <div className="relative mt-2">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                <input
                                    type="number"
                                    required
                                    value={formData.cooldownSec}
                                    onChange={e => setFormData({ ...formData, cooldownSec: parseInt(e.target.value) })}
                                    className="w-full pl-11 pr-12 py-3 rounded-2xl border border-emerald-500/10 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">sec</span>
                            </div>
                        </label>
                    </section>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 px-6 rounded-2xl font-bold text-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-zinc-500"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={saving}
                        onClick={handleSubmit}
                        className="flex-[2] py-3 px-6 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {saving ? "Deploying..." : (flow ? "Commit Changes" : "Activate Flow")}
                    </button>
                </div>
            </div>
        </div>
    );
}

