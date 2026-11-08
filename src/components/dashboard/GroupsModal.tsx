"use client";

/** Create, edit, reorder and delete device groups (/api/groups). */
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, FolderPlus, Pencil, Radio, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { deviceDisplayName, deviceId, deviceUi } from "@/lib/deviceUi";
import { Button, ColorPicker, Field, IconBadge, IconPicker, Input, Modal, Notice } from "@/components/common/ui";

export interface DeviceGroup {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    order: number;
    collapsed: boolean;
    deviceIds: string[];
}

type Draft = { id?: string; name: string; icon: string | null; color: string | null; deviceIds: string[] };

export default function GroupsModal({
    open,
    onClose,
    groups,
    devices,
    onChange,
}: {
    open: boolean;
    onClose: () => void;
    groups: DeviceGroup[];
    devices: any[];
    onChange: (groups: DeviceGroup[]) => void;
}) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    function close() {
        setDraft(null);
        setError("");
        setConfirmDelete(null);
        onClose();
    }

    async function saveDraft() {
        if (!draft) return;
        if (!draft.name.trim()) return setError("Give the group a name.");
        setBusy(true);
        setError("");
        try {
            const body = { name: draft.name.trim(), icon: draft.icon, color: draft.color, deviceIds: draft.deviceIds };
            if (draft.id) {
                const r: any = await apiRequest(`/api/groups/${draft.id}`, { method: "PATCH", body });
                onChange(groups.map((g) => (g.id === draft.id ? r.group : g)));
            } else {
                const r: any = await apiRequest("/api/groups", { method: "POST", body: { ...body, order: groups.length } });
                onChange([...groups, r.group]);
            }
            setDraft(null);
        } catch (e: any) {
            setError(e.message || "Couldn't save the group.");
        } finally {
            setBusy(false);
        }
    }

    async function move(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= groups.length) return;
        const next = [...groups];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next); // optimistic
        setError("");
        try {
            const r: any = await apiRequest("/api/groups/order", { method: "PUT", body: { groupIds: next.map((g) => g.id) } });
            if (Array.isArray(r?.groups)) onChange(r.groups);
        } catch (e: any) {
            onChange(groups);
            setError(e.message || "Couldn't save the new order.");
        }
    }

    async function remove(id: string) {
        setBusy(true);
        setError("");
        try {
            await apiRequest(`/api/groups/${id}`, { method: "DELETE" });
            onChange(groups.filter((g) => g.id !== id));
            setConfirmDelete(null);
        } catch (e: any) {
            setError(e.message || "Couldn't delete the group.");
        } finally {
            setBusy(false);
        }
    }

    const toggleDevice = (id: string) =>
        setDraft((d) => d && { ...d, deviceIds: d.deviceIds.includes(id) ? d.deviceIds.filter((x) => x !== id) : [...d.deviceIds, id] });

    return (
        <Modal
            open={open}
            onClose={close}
            title={draft ? (draft.id ? "Edit group" : "New group") : "Device groups"}
            footer={
                draft ? (
                    <>
                        <Button variant="ghost" onClick={() => { setDraft(null); setError(""); }}>Cancel</Button>
                        <Button variant="primary" onClick={saveDraft} loading={busy}>{draft.id ? "Save group" : "Create group"}</Button>
                    </>
                ) : (
                    <Button variant="primary" onClick={() => setDraft({ name: "", icon: null, color: null, deviceIds: [] })} disabled={groups.length >= 100}>
                        <FolderPlus className="h-4 w-4" /> New group
                    </Button>
                )
            }
        >
            {draft ? (
                <div className="space-y-5">
                    <button type="button" onClick={() => setDraft(null)} className="-mt-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                        <ChevronLeft className="h-4 w-4" /> All groups
                    </button>
                    <Field label="Name">{(id) => <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} placeholder="e.g. Greenhouse" autoFocus />}</Field>
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</div>
                        <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Colour</div>
                        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Devices <span className="font-normal text-zinc-500">({draft.deviceIds.length} selected; a device can be in several groups)</span>
                        </div>
                        {devices.length === 0 ? (
                            <Notice>You don&apos;t have any devices yet.</Notice>
                        ) : (
                            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                                {devices.map((d) => {
                                    const id = deviceId(d);
                                    const ui = deviceUi(d);
                                    const checked = draft.deviceIds.includes(id);
                                    return (
                                        <li key={id}>
                                            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                                <input type="checkbox" checked={checked} onChange={() => toggleDevice(id)} className="h-5 w-5 rounded accent-zinc-900 dark:accent-white" />
                                                <IconBadge icon={ui.icon} color={ui.color} fallback={Radio} size="sm" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{deviceDisplayName(d)}</span>
                                                    <span className="block truncate font-mono text-xs text-zinc-500">{id}</span>
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            ) : groups.length === 0 ? (
                <div className="py-6 text-center">
                    <p className="font-semibold text-zinc-900 dark:text-white">No groups yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">Groups split the dashboard into sections, like &quot;Greenhouse&quot; or &quot;Barn&quot;.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {groups.map((g, i) => (
                        <li key={g.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2 pl-3 dark:border-zinc-800">
                            <IconBadge icon={g.icon} color={g.color} size="sm" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{g.name}</div>
                                <div className="text-xs text-zinc-500">{g.deviceIds.length} device{g.deviceIds.length === 1 ? "" : "s"}</div>
                            </div>
                            {confirmDelete === g.id ? (
                                <div className="flex items-center gap-1">
                                    <Button variant="danger" className="h-9 px-3" onClick={() => remove(g.id)} loading={busy}>Delete</Button>
                                    <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmDelete(null)}>Keep</Button>
                                </div>
                            ) : (
                                <>
                                    <IconButton label={`Move ${g.name} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></IconButton>
                                    <IconButton label={`Move ${g.name} down`} onClick={() => move(i, 1)} disabled={i === groups.length - 1}><ArrowDown className="h-4 w-4" /></IconButton>
                                    <IconButton label={`Edit ${g.name}`} onClick={() => setDraft({ id: g.id, name: g.name, icon: g.icon, color: g.color, deviceIds: [...g.deviceIds] })}><Pencil className="h-4 w-4" /></IconButton>
                                    <IconButton label={`Delete ${g.name}`} onClick={() => setConfirmDelete(g.id)} danger><Trash2 className="h-4 w-4" /></IconButton>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {!draft && confirmDelete && <p className="mt-3 text-xs text-zinc-500">Deleting a group doesn&apos;t touch its devices.</p>}
            {error && <Notice tone="error" className="mt-4">{error}</Notice>}
        </Modal>
    );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn("grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800", danger && "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10")}
        >
            {children}
        </button>
    );
}
