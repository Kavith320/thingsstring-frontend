"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { clearAuth, getToken, setAuth } from "@/lib/auth/storage";
import { applyTheme } from "@/lib/theme";
import { ROLE_HELP, ROLE_LABELS } from "@/lib/deviceUi";
import AuthShell, { AuthButton, AuthField, AuthLink, AuthMessage, AuthSpinner } from "@/components/auth/AuthShell";

interface Invite {
    email: string;
    role: "viewer" | "operator" | "manager";
    deviceId: string;
    deviceName?: string;
    invitedBy?: string;
    expiresAt?: string;
    accountExists: boolean;
}

export default function InviteClient({ token }: { token: string }) {
    const router = useRouter();
    const [invite, setInvite] = useState<Invite | null>(null);
    const [error, setError] = useState(token ? "" : "This invitation link is missing its code. Open the link from your email again.");
    const [loading, setLoading] = useState(!!token);
    const [busy, setBusy] = useState(false);
    const [wrongAccount, setWrongAccount] = useState("");
    const [name, setName] = useState("");
    const [pw, setPw] = useState("");
    const signedIn = typeof window !== "undefined" && !!getToken();
    const looked = useRef(false);

    useEffect(() => {
        if (!token || looked.current) return;
        looked.current = true;
        apiRequest("/api/invites/lookup", { method: "POST", body: { token }, quiet: true })
            .then((r: any) => setInvite(r.invite))
            .catch((e) => setError(e instanceof ApiError && e.status === 400 ? "This invitation is invalid or has expired. Ask for a new one." : e.message))
            .finally(() => setLoading(false));
    }, [token]);

    const goToDevice = (deviceId: string) => router.replace(`/devices/${encodeURIComponent(deviceId)}`);

    async function accept() {
        setBusy(true);
        setError("");
        try {
            const r: any = await apiRequest("/api/invites/accept", { method: "POST", body: { token }, quiet: true });
            goToDevice(r.deviceId);
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 403) setWrongAccount(e.message);
            else setError(e.message || "Couldn't accept the invitation.");
            setBusy(false);
        }
    }

    async function register(e: React.FormEvent) {
        e.preventDefault();
        if (!invite) return;
        if (!name.trim()) return setError("Please enter your name.");
        if (pw.length < 8 || pw.length > 128) return setError("The password must be 8 to 128 characters.");
        setBusy(true);
        setError("");
        try {
            const r: any = await apiRequest("/api/auth/register", {
                method: "POST",
                body: { name: name.trim(), email: invite.email, password: pw, inviteToken: token },
                quiet: true,
            });
            setAuth({ token: r.token, userId: r.user?.id, userId8: r.user?.userId8 });
            if (r.user?.preferences?.theme) applyTheme(r.user.preferences.theme);
            if (r.invite?.deviceId) goToDevice(r.invite.deviceId);
            else router.replace("/dashboard");
        } catch (err: any) {
            setError(err.message || "Couldn't create your account.");
            setBusy(false);
        }
    }

    function switchAccount() {
        clearAuth();
        window.location.href = `/login?next=${encodeURIComponent(`/invite?token=${token}`)}`;
    }

    const loginHref = `/login?next=${encodeURIComponent(`/invite?token=${token}`)}`;

    return (
        <AuthShell title="Device invitation">
            {loading && <AuthSpinner label="Opening invitation…" />}
            {!loading && !invite && error && (
                <div className="space-y-4">
                    <AuthMessage tone="error">{error}</AuthMessage>
                    <AuthLink href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Go to dashboard" : "Sign in"}</AuthLink>
                </div>
            )}
            {invite && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-base leading-relaxed">
                            <b>{invite.invitedBy || "Someone"}</b> invited you to <b>{invite.deviceName || invite.deviceId}</b> as{" "}
                            <b>{ROLE_LABELS[invite.role] || invite.role}</b>.
                        </p>
                        {ROLE_HELP[invite.role] && <p className="mt-1 text-sm text-gray-400">{ROLE_HELP[invite.role]}.</p>}
                        {invite.expiresAt && <p className="mt-2 text-xs text-gray-500">Valid until {new Date(invite.expiresAt).toLocaleDateString()}</p>}
                    </div>

                    {error && <AuthMessage tone="error">{error}</AuthMessage>}

                    {wrongAccount ? (
                        <div className="space-y-3">
                            <AuthMessage tone="error">{wrongAccount}</AuthMessage>
                            <AuthButton onClick={switchAccount}>Sign out and switch account</AuthButton>
                        </div>
                    ) : invite.accountExists ? (
                        signedIn ? (
                            <AuthButton onClick={accept} loading={busy}>Accept invitation</AuthButton>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-300">Sign in as <b>{invite.email}</b> to accept.</p>
                                <AuthLink href={loginHref}>Sign in to accept</AuthLink>
                            </div>
                        )
                    ) : (
                        <form onSubmit={register} className="space-y-4">
                            <p className="text-sm text-gray-300">Create your ThingsString account to get started.</p>
                            <AuthField label="Email" value={invite.email} disabled readOnly hint="The invitation was sent to this address." />
                            <AuthField label="Your name" autoComplete="name" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} />
                            <AuthField label="Password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters" />
                            <AuthButton type="submit" loading={busy}>Create account and open device</AuthButton>
                        </form>
                    )}
                </div>
            )}
        </AuthShell>
    );
}
