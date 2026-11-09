"use client";

/** Members and invitations for one device (manager+). Backend SHARING_FRONTEND_GUIDE.md §2. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { ApiError, apiRequest, NetworkError } from "@/lib/api";
import { Avatar } from "@/lib/icons";
import { useProfile } from "@/lib/profile";
import { ROLE_HELP, ROLE_LABELS, type DeviceRole } from "@/lib/deviceUi";
import { Button, Field, Input, Modal, Notice, Select } from "@/components/common/ui";

interface Person { userId: string; name: string; email: string; avatar: string | null; role?: DeviceRole; since?: string }
interface Invite { id: string; email: string; role: DeviceRole; invitedBy?: string; createdAt?: string; expiresAt?: string }
interface Members { yourRole: DeviceRole; owner: Person; members: Person[]; invites: Invite[] }

type Status = { tone: "success" | "error" | "warning"; text: string } | null;

export default function DeviceSharingModal({ deviceId, deviceName, open, onClose }: { deviceId: string; deviceName: string; open: boolean; onClose: () => void }) {
    if (!open) return null;
    return <SharingBody deviceId={deviceId} deviceName={deviceName} onClose={onClose} />;
}

function SharingBody({ deviceId, deviceName, onClose }: { deviceId: string; deviceName: string; onClose: () => void }) {
    const { profile } = useProfile();
    const [data, setData] = useState<Members | null>(null);
    const [loadError, setLoadError] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<DeviceRole>("viewer");
    const [busy, setBusy] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    // Synchronous guard: a held Enter key or fast clicks fire several submits before React
    // re-renders the disabled button, and each one would send another invitation email.
    const sending = useRef(false);
    const base = `/api/devices/${encodeURIComponent(deviceId)}`;

    const load = useCallback(() => {
        apiRequest(`${base}/members`, { quiet: true })
            .then((r: any) => setData(r))
            .catch((e) =>
                setLoadError(
                    e instanceof ApiError && e.status === 404 && /not found/i.test(e.message) && !/device/i.test(e.message)
                        ? "Your server doesn't support sharing yet. Update the backend first."
                        : e.message || "Couldn't load the people on this device."
                )
            );
    }, [base]);
    useEffect(load, [load]);

    const isOwner = data?.yourRole === "owner";
    // Managers can only invite or change viewers and operators
    const assignable: DeviceRole[] = isOwner ? ["viewer", "operator", "manager"] : ["viewer", "operator"];

    function explain(e: any): string {
        if (e instanceof NetworkError) {
            return "The connection dropped before the server answered, so it may already have been sent. Check the list below before sending again.";
        }
        if (e instanceof ApiError) {
            if (e.code === "EMAIL_NOT_VERIFIED") return "Verify your own email first (see the banner at the top), then you can invite people.";
            if (e.status === 409) return "That person already has access. Change their role in the list instead.";
            if (e.status === 503) return "Today's email limit is used up. Try again tomorrow.";
            if (e.status === 429) return e.message || "Too many invitations. Try again later.";
        }
        return e?.message || "Something went wrong.";
    }

    async function invite(e?: React.FormEvent, again?: Invite) {
        e?.preventDefault();
        const to = (again?.email || email).trim();
        const r = again?.role || role;
        if (!/^\S+@\S+\.\S+$/.test(to)) return setStatus({ tone: "error", text: "Enter a valid email address." });
        if (sending.current) return;
        sending.current = true;
        setBusy(again ? `resend:${again.id}` : "invite");
        setStatus(null);
        try {
            const res: any = await apiRequest(`${base}/invites`, { method: "POST", body: { email: to, role: r }, quiet: true });
            setStatus(
                res?.alreadySent
                    ? { tone: "success", text: `An invitation was just sent to ${to}. You can send it again in 2 minutes.` }
                    : { tone: "success", text: `Invitation ${again ? "sent again" : "sent"} to ${to}. The link works for 7 days.` }
            );
            if (!again) setEmail("");
            load();
        } catch (err) {
            setStatus({ tone: "error", text: explain(err) });
            if (err instanceof NetworkError) load(); // show whether it went through
        } finally {
            sending.current = false;
            setBusy(null);
        }
    }

    async function act(key: string, fn: () => Promise<unknown>, done: string) {
        setBusy(key);
        setStatus(null);
        try {
            await fn();
            setStatus({ tone: "success", text: done });
            setConfirmRemove(null);
            load();
        } catch (err) {
            setStatus({ tone: "error", text: explain(err) });
        } finally {
            setBusy(null);
        }
    }

    const canEdit = (p: Person) => isOwner || (p.role !== "manager" && data?.yourRole === "manager");
    const total = (data?.members.length || 0) + (data?.invites.length || 0);

    return (
        <Modal open onClose={onClose} title={`Share “${deviceName}”`} wide>
            {loadError ? (
                <Notice tone="warning">{loadError}</Notice>
            ) : !data ? (
                <div className="space-y-2" aria-hidden>
                    {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Invite */}
                    <form onSubmit={invite} className="space-y-3 rounded-xl border border-zinc-200 p-3 sm:p-4 dark:border-zinc-800">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white"><UserPlus className="h-4 w-4" /> Invite someone</h3>
                        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                            <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="off" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
                            <Field label="Role">
                                {(id) => (
                                    <Select id={id} value={role} onChange={(e) => setRole(e.target.value as DeviceRole)}>
                                        {assignable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                    </Select>
                                )}
                            </Field>
                        </div>
                        <p className="text-xs text-zinc-500">{ROLE_LABELS[role]}: {ROLE_HELP[role as Exclude<DeviceRole, "owner">]}. They can sign up from the email if they don&apos;t have an account.</p>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-zinc-500">{total}/25 people</span>
                            <Button type="submit" variant="primary" loading={busy === "invite"} disabled={!email || total >= 25}>
                                <Mail className="h-4 w-4" /> Send invitation
                            </Button>
                        </div>
                    </form>

                    {status && <Notice tone={status.tone}>{status.text}</Notice>}

                    {/* People */}
                    <section>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">People with access</h3>
                        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                            <PersonRow person={data.owner} you={data.owner.userId === profile?.id} right={<span className="text-sm font-medium text-zinc-500">Owner</span>} />
                            {data.members.map((m) => (
                                <PersonRow
                                    key={m.userId}
                                    person={m}
                                    you={m.userId === profile?.id}
                                    right={
                                        confirmRemove === m.userId ? (
                                            <div className="flex gap-1">
                                                <Button variant="danger" className="h-9 px-3" loading={busy === `rm:${m.userId}`}
                                                    onClick={() => act(`rm:${m.userId}`, () => apiRequest(`${base}/members/${m.userId}`, { method: "DELETE", quiet: true }), `${m.name || m.email} no longer has access.`)}>
                                                    Remove
                                                </Button>
                                                <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmRemove(null)}>Keep</Button>
                                            </div>
                                        ) : canEdit(m) ? (
                                            <div className="flex items-center gap-1">
                                                <Select
                                                    aria-label={`Role for ${m.name || m.email}`}
                                                    value={m.role}
                                                    disabled={busy === `role:${m.userId}`}
                                                    className="h-9 w-32"
                                                    onChange={(e) => {
                                                        const next = e.target.value;
                                                        act(`role:${m.userId}`, () => apiRequest(`${base}/members/${m.userId}`, { method: "PATCH", body: { role: next }, quiet: true }),
                                                            `${m.name || m.email} is now ${ROLE_LABELS[next as DeviceRole]}.${m.role === "manager" ? " Their schedules and automations on this device are paused." : ""}`);
                                                    }}
                                                >
                                                    {(isOwner ? ["viewer", "operator", "manager"] : ["viewer", "operator"]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r as DeviceRole]}</option>)}
                                                </Select>
                                                <button type="button" onClick={() => setConfirmRemove(m.userId)} aria-label={`Remove ${m.name || m.email}`} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-sm font-medium text-zinc-500">{ROLE_LABELS[m.role || "viewer"]}</span>
                                        )
                                    }
                                />
                            ))}
                        </ul>
                        {confirmRemove && <p className="mt-2 text-xs text-zinc-500">Removing someone ends their access now. Their schedules and automations on this device are turned off, not deleted.</p>}
                    </section>

                    {/* Pending */}
                    {data.invites.length > 0 && (
                        <section>
                            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">Pending invitations</h3>
                            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                                {data.invites.map((inv) => (
                                    <li key={inv.id} className="flex flex-wrap items-center gap-3 p-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800"><Mail className="h-4 w-4" /></span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{inv.email}</div>
                                            <div className="text-xs text-zinc-500">
                                                {ROLE_LABELS[inv.role]}{inv.expiresAt ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}` : ""}
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-end gap-1 sm:w-auto">
                                        <Button variant="ghost" className="h-9 px-3" loading={busy === `resend:${inv.id}`} onClick={() => invite(undefined, inv)}>
                                            <RotateCw className="h-4 w-4" /> Resend
                                        </Button>
                                        <Button variant="ghost" className="h-9 px-3" loading={busy === `cancel:${inv.id}`}
                                            onClick={() => act(`cancel:${inv.id}`, () => apiRequest(`${base}/invites/${inv.id}`, { method: "DELETE", quiet: true }), `Invitation to ${inv.email} cancelled.`)}>
                                            <X className="h-4 w-4" /> Cancel
                                        </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </Modal>
    );
}

function PersonRow({ person, you, right }: { person: Person; you: boolean; right: React.ReactNode }) {
    return (
        <li className="flex flex-wrap items-center gap-3 p-3">
            <Avatar value={person.avatar} name={person.name} size={36} />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {person.name || person.email}
                    {you && <span className="ml-1.5 text-xs font-normal text-zinc-500">(you)</span>}
                </div>
                <div className="truncate text-xs text-zinc-500">{person.email}</div>
            </div>
            {right}
        </li>
    );
}
