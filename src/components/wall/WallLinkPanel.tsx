"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Link2, Link2Off, Monitor, RefreshCw, ShieldCheck } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { Button, Field, Input, Modal, Notice } from "@/components/common/ui";
import { useProfile } from "@/lib/profile";
import { wallUrl } from "@/lib/wall";
import { ago } from "@/components/wall/WallView";

export interface WallMeta {
    saved: boolean;
    link: { token: string | null; unreadable?: boolean; createdAt: string } | null;
    pin: { enabled: boolean; updatedAt: string | null };
    screens: number;
    lastViewedAt: string | null;
}

export default function WallLinkPanel({ meta, onMeta, beforeCreate }: { meta: WallMeta; onMeta: (r: any) => void; beforeCreate: () => Promise<boolean> }) {
    const { profile } = useProfile();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [confirm, setConfirm] = useState<null | "new" | "off" | "pin-off">(null);
    const [pinOpen, setPinOpen] = useState(false);
    const [pin, setPin] = useState("");
    const unverified = profile?.emailVerified === false;
    const url = meta.link?.token ? wallUrl(meta.link.token) : null;

    async function run(what: string, fn: () => Promise<any>) {
        setBusy(what);
        setError("");
        try {
            onMeta(await fn());
            return true;
        } catch (e: any) {
            setError(e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED" ? "Confirm your email address first (check your inbox), then try again." : e.message || "Something went wrong.");
            return false;
        } finally {
            setBusy(null);
        }
    }

    async function create() {
        if (!(await beforeCreate())) return;
        await run("create", () => apiRequest("/api/wall/link", { method: "POST" }));
    }

    async function copy() {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Couldn't copy. Select the link and copy it by hand.");
        }
    }

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><Link2 className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-zinc-900 dark:text-white">Public link</h2>
                    <p className="text-sm text-zinc-500">Anyone with the link sees this wall without logging in. They can only look: nothing can be switched or changed from it.</p>
                </div>
            </div>

            {error && <Notice tone="error" className="mt-4">{error}</Notice>}

            {!meta.link ? (
                <div className="mt-4 space-y-3">
                    {unverified && <Notice tone="warning">Confirm your email address to create a public link.</Notice>}
                    <Button variant="primary" onClick={create} loading={busy === "create"} disabled={unverified}>
                        <Link2 className="h-4 w-4" /> Create public link
                    </Button>
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    {url ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input readOnly value={url} aria-label="Wall link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                            <div className="flex shrink-0 gap-2">
                                <Button onClick={copy} className="flex-1 sm:flex-none">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</Button>
                                <Button onClick={() => window.open(url, "_blank", "noopener,noreferrer")} className="flex-1 sm:flex-none"><ExternalLink className="h-4 w-4" /> Open</Button>
                            </div>
                        </div>
                    ) : (
                        <Notice tone="warning">This link can&apos;t be shown any more (the server&apos;s key changed). It still works on screens that have it; make a new link to get one you can copy.</Notice>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5"><Monitor className="h-4 w-4" /> Open on {meta.screens} screen{meta.screens === 1 ? "" : "s"} now</span>
                        <span>Last opened {ago(meta.lastViewedAt, Date.now())}</span>
                        <span>Created {new Date(meta.link.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                        <div className="flex items-center gap-3">
                            <KeyRound className="h-5 w-5 text-zinc-500" />
                            <div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-white">PIN {meta.pin.enabled ? "on" : "off"}</div>
                                <div className="text-xs text-zinc-500">{meta.pin.enabled ? "Screens ask for it once and remember it for 30 days." : "Add a PIN so the link alone isn't enough."}</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => { setPin(""); setPinOpen(true); }}>{meta.pin.enabled ? "Change PIN" : "Set PIN"}</Button>
                            {meta.pin.enabled && <Button variant="ghost" onClick={() => setConfirm("pin-off")}>Remove</Button>}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setConfirm("new")} loading={busy === "new"}><RefreshCw className="h-4 w-4" /> New link</Button>
                        <Button variant="danger" onClick={() => setConfirm("off")} loading={busy === "off"}><Link2Off className="h-4 w-4" /> Turn off link</Button>
                    </div>
                </div>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs text-zinc-500">
                <ShieldCheck className="mt-px h-4 w-4 shrink-0" />
                The screen only gets the tiles you add: no device IDs, locations, schedules or account details. If the link leaks, make a new one and the old one stops on every screen at once.
            </p>

            <Modal
                open={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm === "new" ? "Make a new link?" : confirm === "off" ? "Turn off the link?" : "Remove the PIN?"}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setConfirm(null)}>Cancel</Button>
                        <Button
                            variant={confirm === "new" ? "primary" : "danger"}
                            loading={!!busy}
                            onClick={async () => {
                                const c = confirm;
                                const ok =
                                    c === "new"
                                        ? await run("new", () => apiRequest("/api/wall/link", { method: "POST" }))
                                        : c === "off"
                                          ? await run("off", () => apiRequest("/api/wall/link", { method: "DELETE" }))
                                          : await run("pin-off", () => apiRequest("/api/wall/pin", { method: "DELETE" }));
                                if (ok) setConfirm(null);
                            }}
                        >
                            {confirm === "new" ? "Make new link" : confirm === "off" ? "Turn off" : "Remove PIN"}
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {confirm === "new"
                        ? "The current link stops working right away on every screen. You'll need to open the new link on them."
                        : confirm === "off"
                          ? "Every screen showing this wall stops right away. You can create a new link later."
                          : "Anyone with the link will be able to open the wall without a PIN."}
                </p>
            </Modal>

            <Modal
                open={pinOpen}
                onClose={() => setPinOpen(false)}
                title={meta.pin.enabled ? "Change PIN" : "Set a PIN"}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setPinOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            disabled={!/^\d{4,8}$/.test(pin)}
                            loading={busy === "pin"}
                            onClick={async () => {
                                if (await run("pin", () => apiRequest("/api/wall/pin", { method: "PUT", body: { pin } }))) setPinOpen(false);
                            }}
                        >
                            Save PIN
                        </Button>
                    </div>
                }
            >
                <Field label="PIN" hint="4 to 8 digits. 6 or more is safer. Every open screen will ask for the new PIN.">
                    {(id) => (
                        <Input
                            id={id}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                            inputMode="numeric"
                            autoComplete="new-password"
                            className="text-center text-lg font-semibold tracking-[0.3em]"
                        />
                    )}
                </Field>
            </Modal>
        </section>
    );
}
