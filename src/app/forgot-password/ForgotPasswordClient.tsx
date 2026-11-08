"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import AuthShell, { AuthButton, AuthField, AuthLink, AuthMessage } from "@/components/auth/AuthShell";

export default function ForgotPasswordClient() {
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState("");
    const [error, setError] = useState("");

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            const r: any = await apiRequest("/api/auth/forgot-password", { method: "POST", body: { email: email.trim() }, quiet: true });
            // Same answer whether or not the account exists (no account enumeration)
            setDone(r?.message || "If an account exists for that email, a reset link has been sent.");
        } catch (err: any) {
            setError(err.message || "Couldn't send the email. Try again later.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one">
            {done ? (
                <div className="space-y-4">
                    <AuthMessage tone="success">{done}</AuthMessage>
                    <p className="text-sm text-gray-400">The link works for 30 minutes. Check your spam folder if it doesn&apos;t arrive.</p>
                    <AuthLink href="/login">Back to sign in</AuthLink>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    {error && <AuthMessage tone="error">{error}</AuthMessage>}
                    <AuthField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    <AuthButton type="submit" loading={busy}>Send reset link</AuthButton>
                    <AuthLink href="/login">Back to sign in</AuthLink>
                </form>
            )}
        </AuthShell>
    );
}
