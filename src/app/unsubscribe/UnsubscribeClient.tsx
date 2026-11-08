"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import AuthShell, { AuthButton, AuthLink, AuthMessage } from "@/components/auth/AuthShell";

/**
 * Turn off alert emails from a link. Needs a click (not automatic on load), because some
 * mail scanners open links and run their scripts, which would unsubscribe people silently.
 */
export default function UnsubscribeClient({ token }: { token: string }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(
        token ? null : { tone: "error", text: "This link is missing its code. Open the link from your email again." }
    );

    async function unsubscribe() {
        setBusy(true);
        try {
            const r: any = await apiRequest("/api/auth/unsubscribe", { method: "POST", body: { token }, quiet: true });
            setResult({
                tone: "success",
                text:
                    r?.category === "automation"
                        ? "Automation emails are now off. You can turn them back on in Settings → Notifications."
                        : "Offline alerts for this device are now off. You can turn them back on in the device's settings → Alerts.",
            });
        } catch (e: any) {
            setResult({ tone: "error", text: e.message || "This link is invalid or has expired." });
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell title="Turn off these emails">
            <div className="space-y-4">
                {result ? (
                    <AuthMessage tone={result.tone}>{result.text}</AuthMessage>
                ) : (
                    <>
                        <p className="text-sm text-gray-300">Stop receiving this type of alert email? Security emails (like password changes) are always sent.</p>
                        <AuthButton onClick={unsubscribe} loading={busy}>Turn off</AuthButton>
                    </>
                )}
                <AuthLink href="/settings">Manage notifications</AuthLink>
            </div>
        </AuthShell>
    );
}
