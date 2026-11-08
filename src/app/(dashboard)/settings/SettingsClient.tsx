"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Lock, Monitor, Moon, Palette, Sun, Trash2, User } from "lucide-react";
import { apiRequest, apiUpload } from "@/lib/api";
import { setAuth } from "@/lib/auth/storage";
import { resizeImage } from "@/lib/image";
import { AVATAR_NAMES, Avatar } from "@/lib/icons";
import { applyTheme, type ThemePref } from "@/lib/theme";
import { DEFAULT_PREFERENCES, setPreferences, setProfile, useProfile, type Preferences, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/common/ui";

const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Password", icon: Lock },
    { id: "preferences", label: "Preferences", icon: Palette },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Status = { tone: "success" | "error"; text: string } | null;

export default function SettingsClient() {
    const { profile, loading, supported, error } = useProfile();
    const [tab, setTab] = useState<TabId>("profile");

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your profile, password and app preferences</p>
            </div>

            {!supported && (
                <Notice tone="warning">
                    Your server doesn&apos;t support profile settings yet. Update the backend to edit your profile and password.
                    The theme below still works on this device.
                </Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}

            <div role="tablist" aria-label="Settings sections" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition",
                            tab === t.id ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        <t.icon className="hidden h-4 w-4 sm:block" />
                        {t.label}
                    </button>
                ))}
            </div>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
                {loading && !profile ? (
                    <div className="space-y-3" aria-hidden>
                        <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                        <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                        <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                ) : tab === "profile" ? (
                    <ProfileTab profile={profile} disabled={!supported} />
                ) : tab === "security" ? (
                    <PasswordTab profile={profile} disabled={!supported} />
                ) : (
                    <PreferencesTab preferences={profile?.preferences || DEFAULT_PREFERENCES} supported={supported} />
                )}
            </section>
        </div>
    );
}

/* ---------------- Profile ---------------- */
function ProfileTab({ profile, disabled }: { profile: Profile | null; disabled: boolean }) {
    const [form, setForm] = useState(() => ({
        name: profile?.name || "",
        phone: profile?.phone || "",
        organization: profile?.organization || "",
        country: profile?.country || "",
        bio: profile?.bio || "",
    }));
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<Status>(null);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarStatus, setAvatarStatus] = useState<Status>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const dirty = useMemo(
        () => !!profile && (["name", "phone", "organization", "country", "bio"] as const).some((k) => (form[k] || "") !== (profile[k] || "")),
        [form, profile]
    );

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return setStatus({ tone: "error", text: "Please enter your name." });
        setSaving(true);
        setStatus(null);
        try {
            const r: any = await apiRequest("/api/me", { method: "PATCH", body: { ...form, name: form.name.trim() } });
            setProfile(r.user);
            setStatus({ tone: "success", text: "Profile saved." });
        } catch (err: any) {
            setStatus({ tone: "error", text: err.message || "Couldn't save your profile." });
        } finally {
            setSaving(false);
        }
    }

    async function chooseAvatar(ref: string | null) {
        setAvatarBusy(true);
        setAvatarStatus(null);
        try {
            const r: any = ref === null && profile?.avatar?.startsWith("file:")
                ? await apiRequest("/api/me/avatar", { method: "DELETE" })
                : await apiRequest("/api/me", { method: "PATCH", body: { avatar: ref } });
            setProfile(r.user);
        } catch (err: any) {
            setAvatarStatus({ tone: "error", text: err.message || "Couldn't change your picture." });
        } finally {
            setAvatarBusy(false);
        }
    }

    async function uploadAvatar(file: File) {
        setAvatarBusy(true);
        setAvatarStatus(null);
        try {
            const blob = await resizeImage(file, 256, { square: true });
            const r: any = await apiUpload("/api/me/avatar", blob, "PUT");
            setProfile(r.user);
            setAvatarStatus({ tone: "success", text: "Photo updated." });
        } catch (err: any) {
            setAvatarStatus({ tone: "error", text: err.message || "Upload failed." });
        } finally {
            setAvatarBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <div className="space-y-8">
            {/* Avatar */}
            <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Picture</h3>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative w-fit">
                        <Avatar value={profile?.avatar} name={profile?.name} size={80} />
                        {avatarBusy && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /></span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => fileRef.current?.click()} disabled={disabled || avatarBusy}>
                            <Camera className="h-4 w-4" /> Upload photo
                        </Button>
                        {profile?.avatar && (
                            <Button variant="ghost" onClick={() => chooseAvatar(null)} disabled={disabled || avatarBusy}>
                                <Trash2 className="h-4 w-4" /> Remove
                            </Button>
                        )}
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                    </div>
                </div>
                <p className="mt-4 text-sm text-zinc-500">Or pick one:</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Built-in avatars">
                    {AVATAR_NAMES.map((n) => {
                        const ref = `avatar:${n}`;
                        const selected = profile?.avatar === ref;
                        return (
                            <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={`Avatar ${n}`}
                                disabled={disabled || avatarBusy}
                                onClick={() => chooseAvatar(ref)}
                                className={cn("rounded-full transition disabled:opacity-50", selected ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900" : "hover:scale-105")}
                            >
                                <Avatar value={ref} size={44} />
                            </button>
                        );
                    })}
                </div>
                {avatarStatus && <Notice tone={avatarStatus.tone} className="mt-3">{avatarStatus.text}</Notice>}
            </div>

            {/* Info */}
            <form onSubmit={save} className="space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set("name")} maxLength={60} autoComplete="name" disabled={disabled} required />}</Field>
                    <Field label="Email" hint="Your sign-in email can't be changed here.">{(id) => <Input id={id} value={profile?.email || ""} disabled readOnly />}</Field>
                    <Field label="Phone">{(id) => <Input id={id} value={form.phone} onChange={set("phone")} maxLength={30} inputMode="tel" autoComplete="tel" disabled={disabled} placeholder="+94 77 123 4567" />}</Field>
                    <Field label="Organisation">{(id) => <Input id={id} value={form.organization} onChange={set("organization")} maxLength={100} autoComplete="organization" disabled={disabled} />}</Field>
                    <Field label="Country">{(id) => <Input id={id} value={form.country} onChange={set("country")} maxLength={60} autoComplete="country-name" disabled={disabled} />}</Field>
                    <Field label="User ID" hint="Used when setting up a new device.">{(id) => <Input id={id} value={profile?.userId8 || profile?.id || ""} disabled readOnly className="font-mono" />}</Field>
                </div>
                <Field label="About" hint={`${form.bio.length}/300`}>{(id) => <Textarea id={id} value={form.bio} onChange={set("bio")} maxLength={300} disabled={disabled} placeholder="What do you use ThingsString for?" />}</Field>
                {status && <Notice tone={status.tone}>{status.text}</Notice>}
                <div className="flex justify-end">
                    <Button type="submit" variant="primary" loading={saving} disabled={disabled || !dirty}>Save profile</Button>
                </div>
            </form>
        </div>
    );
}

/* ---------------- Password ---------------- */
function PasswordTab({ profile, disabled }: { profile: Profile | null; disabled: boolean }) {
    const hasPassword = profile?.hasPassword !== false;
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<Status>(null);

    const mismatch = confirm.length > 0 && confirm !== next;
    const tooShort = next.length > 0 && next.length < 8;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (next.length < 8 || next.length > 128) return setStatus({ tone: "error", text: "The new password must be 8 to 128 characters." });
        if (next !== confirm) return setStatus({ tone: "error", text: "The new passwords don't match." });
        setSaving(true);
        setStatus(null);
        try {
            const r: any = await apiRequest("/api/me/password", { method: "PUT", body: { ...(hasPassword ? { currentPassword: current } : {}), newPassword: next } });
            // Every other session is logged out; this one continues with the new token.
            if (r?.token) setAuth({ token: r.token, userId: undefined, userId8: undefined });
            setCurrent("");
            setNext("");
            setConfirm("");
            setStatus({ tone: "success", text: "Password changed. You've been signed out on your other devices." });
        } catch (err: any) {
            setStatus({ tone: "error", text: err.message || "Couldn't change your password." });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} className="max-w-md space-y-4">
            <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{hasPassword ? "Change password" : "Set a password"}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                    {hasPassword
                        ? "Changing your password signs you out everywhere else."
                        : "You sign in with Google. Set a password to also sign in with your email."}
                </p>
            </div>
            {hasPassword && (
                <Field label="Current password">{(id) => <Input id={id} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" disabled={disabled} required />}</Field>
            )}
            <Field label="New password" error={tooShort ? "At least 8 characters." : undefined}>
                {(id) => <Input id={id} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} disabled={disabled} required />}
            </Field>
            <Field label="Confirm new password" error={mismatch ? "Doesn't match." : undefined}>
                {(id) => <Input id={id} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={disabled} required />}
            </Field>
            {status && <Notice tone={status.tone}>{status.text}</Notice>}
            <Button type="submit" variant="primary" loading={saving} disabled={disabled || !next || mismatch || tooShort || (hasPassword && !current)}>
                {hasPassword ? "Change password" : "Set password"}
            </Button>
        </form>
    );
}

/* ---------------- Preferences ---------------- */
function PreferencesTab({ preferences, supported }: { preferences: Preferences; supported: boolean }) {
    const [status, setStatus] = useState<Status>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const timezones = useMemo(() => {
        try {
            return (Intl as any).supportedValuesOf("timeZone") as string[];
        } catch {
            return ["UTC", "Asia/Colombo"];
        }
    }, []);
    const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

    // Keep the applied theme in sync if the preference changes elsewhere
    useEffect(() => {
        applyTheme(preferences.theme);
    }, [preferences.theme]);

    async function save(patch: Partial<Preferences>) {
        const key = Object.keys(patch)[0];
        setStatus(null);
        setPreferences(patch); // optimistic
        if (patch.theme) applyTheme(patch.theme);
        if (!supported) return;
        setSavingKey(key);
        try {
            const r: any = await apiRequest("/api/me/preferences", { method: "PATCH", body: patch });
            if (r?.preferences) setPreferences(r.preferences);
        } catch (err: any) {
            setStatus({ tone: "error", text: err.message || "Couldn't save that setting." });
        } finally {
            setSavingKey(null);
        }
    }

    const themes: { id: ThemePref; label: string; icon: any }[] = [
        { id: "light", label: "Light", icon: Sun },
        { id: "dark", label: "Dark", icon: Moon },
        { id: "system", label: "Auto", icon: Monitor },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Theme</h3>
                <p className="mt-1 text-sm text-zinc-500">Auto follows your phone or computer setting.</p>
                <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={preferences.theme === t.id}
                            onClick={() => save({ theme: t.id })}
                            className={cn(
                                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                                preferences.theme === t.id
                                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            )}
                        >
                            <t.icon className="h-5 w-5" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-2 dark:border-zinc-800">
                <Field label="Units" hint="Temperatures show in °C or °F.">
                    {(id) => (
                        <Select id={id} value={preferences.units} disabled={!supported || savingKey === "units"} onChange={(e) => save({ units: e.target.value as Preferences["units"] })}>
                            <option value="metric">Metric (°C)</option>
                            <option value="imperial">Imperial (°F)</option>
                        </Select>
                    )}
                </Field>
                <Field label="Time zone" hint="Default for new schedules.">
                    {(id) => (
                        <Select id={id} value={preferences.timezone || ""} disabled={!supported || savingKey === "timezone"} onChange={(e) => save({ timezone: e.target.value || null })}>
                            <option value="">Use this device&apos;s ({browserTz})</option>
                            {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                        </Select>
                    )}
                </Field>
            </div>
            {status && <Notice tone={status.tone}>{status.text}</Notice>}
        </div>
    );
}
