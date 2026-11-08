"use client";

/**
 * The signed-in user's profile and preferences (GET /api/me), shared by every component
 * through one small store, so the sidebar, settings page and readings stay in sync.
 */
import { useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { applyTheme, type ThemePref } from "@/lib/theme";

export interface Preferences {
    theme: ThemePref;
    accentColor: string | null;
    language: string;
    timezone: string | null;
    units: "metric" | "imperial";
}

export interface Profile {
    id: string;
    userId8?: string;
    name: string;
    email: string;
    emailVerified?: boolean;
    role?: string;
    authProvider?: string;
    hasPassword?: boolean;
    phone: string | null;
    organization: string | null;
    country: string | null;
    bio: string | null;
    avatar: string | null;
    preferences: Preferences;
    createdAt?: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
    theme: "system",
    accentColor: null,
    language: "en",
    timezone: null,
    units: "metric",
};

interface State {
    profile: Profile | null;
    loading: boolean;
    /** false when the backend predates /api/me (profile editing unavailable) */
    supported: boolean;
    error: string;
}

let state: State = { profile: null, loading: true, supported: true, error: "" };
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
}

function fallbackProfile(): Profile | null {
    const u = getUser();
    if (!u) return null;
    return {
        id: u.id || "", name: u.name, email: u.email, phone: null, organization: null, country: null, bio: null,
        avatar: null, preferences: DEFAULT_PREFERENCES,
    };
}

export async function refreshProfile() {
    try {
        const res: any = await apiRequest("/api/me", { quiet: true });
        const user: Profile = { ...res.user, preferences: { ...DEFAULT_PREFERENCES, ...(res.user?.preferences || {}) } };
        set({ profile: user, loading: false, supported: true, error: "" });
        applyTheme(user.preferences.theme);
    } catch (e: any) {
        const notSupported = /not found/i.test(e?.message || "");
        set({
            profile: state.profile || fallbackProfile(),
            loading: false,
            supported: notSupported ? false : state.supported,
            error: notSupported ? "" : e?.message || "Couldn't load your profile",
        });
    }
}

/** Replace the cached profile after a successful save. */
export function setProfile(profile: Profile) {
    set({ profile: { ...profile, preferences: { ...DEFAULT_PREFERENCES, ...(profile.preferences || {}) } } });
}

export function setPreferences(prefs: Partial<Preferences>) {
    if (!state.profile) return;
    set({ profile: { ...state.profile, preferences: { ...state.profile.preferences, ...prefs } } });
}

/** Forget the cached profile (on logout / account switch). */
export function resetProfile() {
    started = false;
    set({ profile: null, loading: true, supported: true, error: "" });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};
const getSnapshot = () => state;
const serverSnapshot: State = { profile: null, loading: true, supported: true, error: "" };

export function useProfile() {
    const s = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
    useEffect(() => {
        if (started) return;
        started = true;
        refreshProfile();
    }, []);
    return s;
}

/* -------- Units -------- */

export function useUnits(): Preferences["units"] {
    return useProfile().profile?.preferences.units || "metric";
}

/** Convert a reading for display. Only temperature differs between unit systems here. */
export function convertReading(value: number, unit: string, units: Preferences["units"]): { value: number; unit: string } {
    if (units === "imperial" && /^°?C$/i.test(unit.trim())) {
        return { value: value * 9 / 5 + 32, unit: "°F" };
    }
    return { value, unit };
}
