"use client";

/** Invitations waiting for the signed-in user (GET /api/invites), with accept / decline. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailOpen } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/deviceUi";
import { Button } from "@/components/common/ui";

interface Invite { id: string; deviceId: string; deviceName?: string; role: "viewer" | "operator" | "manager"; invitedBy?: string; expiresAt?: string }

export default function PendingInvites({ onAccepted }: { onAccepted?: () => void }) {
    const router = useRouter();
    const [invites, setInvites] = useState<Invite[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        // Quiet: older backends have no /api/invites, and unverified users get an empty list
        apiRequest("/api/invites", { quiet: true })
            .then((r: any) => setInvites(Array.isArray(r?.invites) ? r.invites : []))
            .catch(() => setInvites([]));
    }, []);

    async function respond(inv: Invite, accept: boolean) {
        setBusy(`${inv.id}:${accept}`);
        setError("");
        try {
            const r: any = await apiRequest(`/api/invites/${inv.id}/${accept ? "accept" : "decline"}`, { method: "POST", quiet: true });
            setInvites((list) => list.filter((x) => x.id !== inv.id));
            if (accept) {
                onAccepted?.();
                router.push(`/devices/${encodeURIComponent(r?.deviceId || inv.deviceId)}`);
            }
        } catch (e: any) {
            setError(e.message || "Couldn't answer the invitation.");
        } finally {
            setBusy(null);
        }
    }

    if (!invites.length) return null;
    return (
        <section aria-label="Invitations" className="space-y-2">
            {invites.map((inv) => (
                <div key={inv.id} className="flex flex-col gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 sm:flex-row sm:items-center">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"><MailOpen className="h-5 w-5" /></span>
                    <p className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-200">
                        <b>{inv.invitedBy || "Someone"}</b> invited you to <b>{inv.deviceName || inv.deviceId}</b> as <b>{ROLE_LABELS[inv.role] || inv.role}</b>.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1 sm:flex-none" loading={busy === `${inv.id}:false`} onClick={() => respond(inv, false)}>Decline</Button>
                        <Button variant="primary" className="flex-1 sm:flex-none" loading={busy === `${inv.id}:true`} onClick={() => respond(inv, true)}>Accept</Button>
                    </div>
                </div>
            ))}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}
