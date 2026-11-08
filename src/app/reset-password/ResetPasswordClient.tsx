"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { setAuth } from "@/lib/auth/storage";
import { applyTheme } from "@/lib/theme";
import AuthShell, { AuthButton, AuthField, AuthLink, AuthMessage } from "@/components/auth/AuthShell";

export default function ResetPasswordClient({ token }: { token: string }) {
    const router = useRouter();
    const [pw, setPw] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(token ? "" : "This link is missing its code. Open the link from your email again.");

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (pw.length < 8 || pw.length > 128) return setError("The password must be 8 to 128 characters.");
        if (pw !== confirm) return setError("The passwords don't match.");
        setBusy(true);
        setError("");
        try {
            const r: any = await apiRequest("/api/auth/reset-password", { method: "POST", body: { token, newPassword: pw }, quiet: true });
            // Every other session was signed out; this response signs the user in
            setAuth({ token: r.token, userId: r.user?.id, userId8: r.user?.userId8 });
            if (r.user?.preferences?.theme) applyTheme(r.user.preferences.theme);
            router.replace("/dashboard");
        } catch (err: any) {
            setError(err.message || "This link is invalid or has expired.");
            setBusy(false);
        }
    }

    return (
        <AuthShell title="Choose a new password" subtitle="You'll be signed out on your other devices">
            <form onSubmit={submit} className="space-y-4">
                {error && (
                    <AuthMessage tone="error">
                        {error}{" "}
                        {/expired|invalid|missing/i.test(error) && <a href="/forgot-password" className="font-semibold underline">Get a new link</a>}
                    </AuthMessage>
                )}
                <AuthField label="New password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters" disabled={!token} />
                <AuthField label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!token} />
                <AuthButton type="submit" loading={busy} disabled={!token}>Save and sign in</AuthButton>
                <AuthLink href="/login">Back to sign in</AuthLink>
            </form>
        </AuthShell>
    );
}
