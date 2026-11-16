"use client";

/**
 * What a smart board reports about itself in its config (`config.board`): the active profile,
 * the SD card, and firmware updates. Mushroom controller firmware 0.3.0+; other devices
 * don't send `board`, so the panel doesn't show for them.
 */
import { useState } from "react";
import { Cpu, Download, HardDrive, Leaf, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button, Notice } from "@/components/common/ui";

export interface BoardRelay {
    mode?: "profile" | "manual" | "cloud";
    rule?: string;
    until?: number; // unix seconds, 0 = none
}

export interface BoardInfo {
    profile?: string;
    manual_timeout_min?: number;
    relays?: Record<string, BoardRelay>;
    sd?: { state?: string; size_mb?: number; free_mb?: number };
    update?: { state?: string; latest?: string };
}

function size(mb?: number) {
    if (!mb) return "0 MB";
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

/** One line under an actuator: who is in charge of it right now. */
export function boardRelayText(r?: BoardRelay): string | null {
    if (!r?.mode) return null;
    if (r.mode === "profile") return r.rule ? `Board profile: ${r.rule}` : "Board profile";
    if (r.mode === "cloud") return "Cloud schedules and automations";
    if (r.until && r.until > 0) {
        const at = new Date(r.until * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `Set by hand · back to the profile at ${at}`;
    }
    return "Set by hand";
}

const SD_TEXT: Record<string, string> = {
    none: "No SD card",
    unformatted: "SD card needs formatting (on the board: Apps › Logs)",
    formatting: "Formatting the SD card…",
};

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-500">{label}</div>
                <div className="text-sm text-zinc-900 dark:text-zinc-100">{children}</div>
            </div>
        </div>
    );
}

export default function BoardPanel({
    deviceId,
    board,
    firmware,
    online,
    canManage,
}: {
    deviceId: string;
    board: BoardInfo;
    firmware: string;
    online: boolean;
    canManage: boolean;
}) {
    const [busy, setBusy] = useState<"" | "update" | "check_update">("");
    const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

    const upd = board.update || {};
    const available = upd.state === "available" && !!upd.latest;
    const installing = upd.state === "installing";

    async function send(action: "update" | "check_update") {
        if (action === "update" && !window.confirm(
            `Install firmware ${upd.latest} on this board?\n\nIt restarts when done, and its outputs are off for a few seconds. If the new version doesn't start properly, the board goes back to the old one by itself.`
        )) return;
        setBusy(action);
        setNote(null);
        try {
            await apiRequest(`/api/devices/${encodeURIComponent(deviceId)}/command`, { method: "POST", body: { action } });
            setNote({
                tone: "success",
                text: action === "update"
                    ? "Sent. The board downloads the update (about a minute), restarts, and then shows the new version here."
                    : "Sent. The board checks GitHub and shows the result here in a few seconds.",
            });
        } catch (e) {
            setNote({ tone: "error", text: e instanceof Error && e.message ? e.message : "Couldn't reach the board." });
        } finally {
            setBusy("");
        }
    }

    let updText = `Firmware ${firmware}`;
    if (installing) updText += ` · installing ${upd.latest || "update"}…`;
    else if (available) updText += ` · ${upd.latest} available`;
    else if (upd.state === "up_to_date") updText += " · up to date";
    else if (upd.state === "failed") updText += " · last update check failed";

    const sd = board.sd || {};
    const sdText = sd.state === "ready" ? `${size(sd.size_mb)}, ${size(sd.free_mb)} free` : SD_TEXT[sd.state || ""] || "Unknown";

    return (
        <section className="rounded-2xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Board</h3>
            </div>
            <div className="px-4 py-2 sm:px-6 divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row icon={Leaf} label="Mushroom profile">
                    {board.profile || "None"}
                    {board.manual_timeout_min ? (
                        <span className="text-zinc-500"> · switching by hand lasts {board.manual_timeout_min} min</span>
                    ) : null}
                </Row>
                <Row icon={HardDrive} label="SD card">{sdText}</Row>
                <Row icon={Cpu} label="Firmware">
                    <span>{updText}</span>
                    {canManage && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {available && (
                                <Button variant="primary" onClick={() => send("update")} loading={busy === "update"} disabled={!online || !!busy || installing}>
                                    <Download className="h-4 w-4" aria-hidden /> Install {upd.latest}
                                </Button>
                            )}
                            <Button onClick={() => send("check_update")} loading={busy === "check_update"} disabled={!online || !!busy || installing}>
                                <RefreshCw className="h-4 w-4" aria-hidden /> Check for update
                            </Button>
                        </div>
                    )}
                    {canManage && !online && <p className="mt-1 text-xs text-zinc-500">The board is offline. Updates need it online.</p>}
                </Row>
            </div>
            {note && <div className="px-4 pb-4 sm:px-6"><Notice tone={note.tone}>{note.text}</Notice></div>}
        </section>
    );
}
