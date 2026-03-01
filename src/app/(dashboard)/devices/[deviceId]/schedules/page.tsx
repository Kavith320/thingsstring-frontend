"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
    cronToUi,
    uiToCron,
    type ScheduleUiState,
    type ScheduleType,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import Switch from "@/components/common/Switch";
import { Calendar } from "lucide-react";

/* ---------------- Types ---------------- */
interface Action {
    actuator: string;
    set: {
        state: string;
        auto: boolean;
    };
}

interface Schedule {
    _id?: string;
    id?: string;
    name: string;
    enabled: boolean;
    timezone: string;
    cron: string;
    actions: Action[];
    duration_sec: number;
    end_actions: Action[];
}

interface Device {
    _id: string;
    config?: {
        actuators?: Record<string, any>;
        scheduler?: {
            timezone?: string;
        };
    };
    control?: {
        actuators?: Record<string, any>;
    };
}

/* ---------------- Components ---------------- */
const Button = ({
    className,
    variant = "outline",
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "outline" | "solid" | "ghost";
}) => {
    const variants = {
        outline:
            "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
        solid:
            "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
        ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
    };
    return (
        <button
            {...props}
            className={cn(
                "rounded-xl px-3 py-2 text-sm disabled:opacity-60 transition font-medium",
                variants[variant],
                className
            )}
        />
    );
};

const Input = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
    <input
        ref={ref}
        {...props}
        className={cn(
            "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950/40 dark:focus:ring-zinc-800",
            props.className
        )}
    />
));
Input.displayName = "Input";

const Select = React.forwardRef<
    HTMLSelectElement,
    React.SelectHTMLAttributes<HTMLSelectElement>
>((props, ref) => (
    <select
        ref={ref}
        {...props}
        className={cn(
            "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950/40 dark:focus:ring-zinc-800",
            props.className
        )}
    />
));
Select.displayName = "Select";

/* ---------------- Helper Logic ---------------- */
function blankSchedule(timezone = "Asia/Colombo"): Schedule {
    return {
        name: "",
        enabled: true,
        timezone,
        cron: "0 0 8 * * *", // default daily 8am
        actions: [{ actuator: "", set: { state: "ON", auto: true } }],
        duration_sec: 0,
        end_actions: [{ actuator: "", set: { state: "OFF", auto: true } }],
    };
}

export default function DeviceSchedulesPage() {
    const params = useParams();
    const deviceId = params?.deviceId as string;

    const [device, setDevice] = useState<Device | null>(null);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formSchedule, setFormSchedule] = useState<Schedule>(blankSchedule());
    const [uiState, setUiState] = useState<ScheduleUiState>({
        type: "daily",
        time: "08:00",
        intervalValue: 15,
        cron: "",
    });

    const baseDeviceSchedulesPath = `/api/schedules/devices/${deviceId}/schedules`;

    async function refreshData() {
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const token = getToken();
            const [devReq, schedReq] = await Promise.all([
                apiRequest(`/api/devices/${deviceId}`),
                apiRequest(baseDeviceSchedulesPath),
            ]);

            setDevice(devReq?.device || devReq);
            setSchedules(
                Array.isArray(schedReq) ? schedReq : schedReq?.schedules || []
            );
        } catch (e: any) {
            setError(e.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (deviceId) refreshData();
    }, [deviceId]);

    const actuatorKeys = useMemo(() => {
        const controlActs = device?.control?.actuators || {};
        const configActs = device?.config?.actuators || {};
        const keys = new Set([
            ...Object.keys(controlActs),
            ...Object.keys(configActs),
        ]);
        return Array.from(keys);
    }, [device]);

    const timezoneDefault =
        device?.config?.scheduler?.timezone || "Asia/Colombo";

    // -- Handlers --

    function handleOpenCreate() {
        setEditingId(null);
        const initial = blankSchedule(timezoneDefault);
        setFormSchedule(initial);
        // sync ui
        setUiState(cronToUi(initial.cron));
        setIsModalOpen(true);
        setError("");
        setMessage("");
    }

    function handleOpenEdit(s: Schedule) {
        setEditingId(s._id || s.id || null);
        setFormSchedule({
            ...s,
            actions: s.actions?.length
                ? s.actions
                : [{ actuator: "", set: { state: "ON", auto: true } }],
            end_actions: s.end_actions?.length
                ? s.end_actions
                : [{ actuator: "", set: { state: "OFF", auto: true } }],
        });
        setUiState(cronToUi(s.cron));
        setIsModalOpen(true);
        setError("");
        setMessage("");
    }

    async function handleSave() {
        setIsSaving(true);
        setError("");
        try {
            // 1. Generate Cron from UI
            const finalCron = uiToCron(uiState);

            // 2. Validate
            if (!formSchedule.name.trim()) throw new Error("Name is required");
            if (!finalCron) throw new Error("Invalid schedule time");

            // 3. Prepare Payload
            const payload: Schedule = {
                ...formSchedule,
                cron: finalCron,
                duration_sec: Number(formSchedule.duration_sec || 0),
                timezone: formSchedule.timezone || timezoneDefault,
            };

            // 4. Send
            const token = getToken();
            if (editingId) {
                await apiRequest(`/api/schedules/${editingId}`, {
                    method: "PUT",
                    body: payload,
                });
                setMessage("✅ Updated successfully");
            } else {
                await apiRequest(baseDeviceSchedulesPath, {
                    method: "POST",
                    body: payload,
                });
                setMessage("✅ Created successfully");
            }

            setIsModalOpen(false);
            refreshData();
        } catch (e: any) {
            setError(e.message || "Save failed");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure?")) return;
        try {
            await apiRequest(`/api/schedules/${id}`, { method: "DELETE" });
            refreshData();
        } catch (e: any) {
            alert(e.message);
        }
    }

    async function handleToggle(s: Schedule) {
        try {
            await apiRequest(`/api/schedules/${s._id || s.id}`, {
                method: "PUT",
                body: { enabled: !s.enabled },
            });
            refreshData();
        } catch (e: any) {
            alert(e.message);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-semibold">Schedules</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Manage automation for <span className="font-mono text-zinc-900 dark:text-zinc-100">{deviceId}</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={refreshData} disabled={loading}>
                        Refresh
                    </Button>
                    <Button variant="solid" onClick={handleOpenCreate} disabled={loading || actuatorKeys.length === 0}>
                        + New Schedule
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                    {error}
                </div>
            ) : null}

            {message ? (
                <div className="p-4 rounded-xl bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                    {message}
                </div>
            ) : null}

            {/* List */}
            <div className="grid gap-3">
                {!loading && schedules.length === 0 && (
                    <div className="p-8 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        No schedules found. Create one to automate your device.
                    </div>
                )}

                {schedules.map((s) => {
                    const id = s._id || s.id || "";
                    const friendly = cronToUi(s.cron);

                    return (
                        <div
                            key={id}
                            className={cn(
                                "p-4 rounded-2xl border bg-white dark:bg-zinc-900/40 transition",
                                s.enabled ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 bg-zinc-50 opacity-75 dark:bg-zinc-950/40 dark:border-zinc-800"
                            )}
                        >
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                                <div>
                                    <div className="font-semibold text-lg flex items-center gap-2">
                                        {s.name}
                                        {!s.enabled && <span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500">Disabled</span>}
                                    </div>
                                    <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                        {friendly.type === 'daily' && `Daily at ${friendly.time}`}
                                        {friendly.type === 'every_hour' && `Every ${friendly.intervalValue} hr(s)`}
                                        {friendly.type === 'every_minute' && `Every ${friendly.intervalValue} min(s)`}
                                        {friendly.type === 'every_second' && `Every ${friendly.intervalValue} sec(s)`}
                                        <span className="mx-2">•</span>
                                        {s.duration_sec > 0 ? `Runs for ${s.duration_sec}s` : "No duration"}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {s.actions.map((a, i) => (
                                            <span key={i} className="text-xs font-mono px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                {a.actuator} = {a.set.state}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2 shrink-0">
                                    <Button variant="ghost" className="text-sm" onClick={() => handleToggle(s)}>
                                        {s.enabled ? "Disable" : "Enable"}
                                    </Button>
                                    <Button variant="outline" onClick={() => handleOpenEdit(s)}>Edit</Button>
                                    <Button variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50" onClick={() => handleDelete(id)}>Delete</Button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="mb-4 text-xl font-bold">
                            {editingId ? "Edit Schedule" : "New Schedule"}
                        </h3>

                        <div className="space-y-5">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Name</label>
                                    <Input
                                        value={formSchedule.name}
                                        onChange={e => setFormSchedule({ ...formSchedule, name: e.target.value })}
                                        placeholder="e.g. Garden Light"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Enable Schedule</label>
                                    <div className="pt-2">
                                        <Switch
                                            checked={formSchedule.enabled}
                                            icon={Calendar}
                                            onChange={(checked) => setFormSchedule({ ...formSchedule, enabled: checked })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Schedule Builder */}
                            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 space-y-4">
                                <div className="font-semibold text-sm">Timing</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Frequency</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(["daily", "every_hour", "every_minute", "every_second"] as const).map(t => (
                                                <button key={t} onClick={() => setUiState({ ...uiState, type: t })}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-sm border transition",
                                                        uiState.type === t
                                                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
                                                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                                    )}
                                                >
                                                    {t === "daily" && "Daily"}
                                                    {t === "every_hour" && "Hourly"}
                                                    {t === "every_minute" && "Minutes"}
                                                    {t === "every_second" && "Seconds"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {uiState.type === 'daily' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-zinc-500">At Time</label>
                                            <Input
                                                type="time"
                                                value={uiState.time}
                                                onChange={(e) => setUiState({ ...uiState, time: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {uiState.type === 'every_hour' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-zinc-500">Every X Hour(s)</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="23"
                                                value={uiState.intervalValue}
                                                onChange={(e) => setUiState({ ...uiState, intervalValue: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}

                                    {uiState.type === 'every_minute' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-zinc-500">Every X Minute(s)</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="59"
                                                value={uiState.intervalValue}
                                                onChange={(e) => setUiState({ ...uiState, intervalValue: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}

                                    {uiState.type === 'every_second' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-zinc-500">Every X Second(s)</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="59"
                                                value={uiState.intervalValue}
                                                onChange={(e) => setUiState({ ...uiState, intervalValue: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 space-y-4">
                                <div className="font-semibold text-sm">Action</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Device Actuator</label>
                                        <Select
                                            value={formSchedule.actions[0]?.actuator || ""}
                                            onChange={(e) => {
                                                const act = e.target.value;
                                                const newActions = [...formSchedule.actions];
                                                if (!newActions.length) newActions.push({ actuator: act, set: { state: "ON", auto: true } });
                                                else newActions[0].actuator = act;

                                                // also sync end action actuator if simplifed mode
                                                const newEnd = [...formSchedule.end_actions];
                                                if (!newEnd.length) newEnd.push({ actuator: act, set: { state: "OFF", auto: true } });
                                                else newEnd[0].actuator = act;

                                                setFormSchedule({ ...formSchedule, actions: newActions, end_actions: newEnd });
                                            }}
                                        >
                                            <option value="">Select Actuator...</option>
                                            {actuatorKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Set State</label>
                                        <Select
                                            value={formSchedule.actions[0]?.set?.state || "ON"}
                                            onChange={(e) => {
                                                const newState = e.target.value;
                                                const newActions = [...formSchedule.actions];
                                                if (newActions.length) newActions[0].set.state = newState;
                                                setFormSchedule({ ...formSchedule, actions: newActions });
                                            }}
                                        >
                                            <option value="ON">Turn ON</option>
                                            <option value="OFF">Turn OFF</option>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Duration (seconds)</label>
                                        <Input
                                            type="number"
                                            value={formSchedule.duration_sec}
                                            onChange={(e) => setFormSchedule({ ...formSchedule, duration_sec: Number(e.target.value) })}
                                            placeholder="0 (Forever)"
                                        />
                                        <p className="text-[10px] text-zinc-400 mt-1">0 = Keep state forever. {'>'}0 = Revert state after time.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
                                <Button variant="solid" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Schedule"}
                                </Button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
