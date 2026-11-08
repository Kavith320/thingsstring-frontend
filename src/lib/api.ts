import { getToken, clearAuth } from "@/lib/auth/storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** No HTTP response at all (as opposed to an error status from the server). */
export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NetworkError";
    }
}

interface RequestOptions {
    method?: string;
    body?: any;
    /** Don't log failures (the caller handles them, e.g. with a fallback) */
    quiet?: boolean;
}

export async function apiRequest<T = any>(
    endpoint: string,
    { method = "GET", body, quiet = false }: RequestOptions = {}
): Promise<T> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // fetch only throws when no HTTP response arrived at all (server unreachable,
    // network drop, blocked request); browsers report that as a "CORS"/"NetworkError".
    // GETs are safe to repeat, so retry those through short blips. Commands (POST/PUT/
    // DELETE) are never retried automatically: the first attempt may have reached the server.
    const retryDelaysMs = method.toUpperCase() === "GET" ? [600, 1500] : [];
    let res: Response | null = null;
    for (let attempt = 0; ; attempt++) {
        try {
            res = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            break;
        } catch {
            if (attempt >= retryDelaysMs.length) {
                throw new NetworkError("Cannot reach the ThingsString server. Check your connection; retrying automatically.");
            }
            await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
        }
    }

    const text = await res.text();
    let data: any = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    // Expired or revoked session (backend bumps tokenVersion on password reset etc.):
    // drop the token and go back to login instead of polling into 401s forever.
    if (res.status === 401 && token && !endpoint.startsWith("/api/auth/") && typeof window !== "undefined") {
        clearAuth();
        const next = encodeURIComponent(window.location.pathname);
        window.location.replace(`/login?next=${next}`);
    }

    if (!res.ok) {
        let msg = `API error (${res.status})`;
        if (typeof data === "object" && data !== null) {
            msg = data.message || data.error || msg;
        } else if (typeof data === "string" && (data.includes("<html") || data.includes("<!DOCTYPE") || data.includes("</body>"))) {
            msg = `Backend connection error (${res.status}). The server at ${API_URL || 'local'} returned an HTML error page instead of JSON. Check your backend status or NEXT_PUBLIC_API_URL setting in .env.`;
        } else if (typeof data === "string" && data.trim()) {
            msg = data;
        }
        if (!quiet) console.error(`API Error (${res.status}):`, msg);
        throw new Error(msg);
    }

    return data as T;
}

/**
 * Download a file from an authenticated endpoint (a plain <a href> can't send the
 * Bearer token). Saves it in the browser under `filename`. Not retried: exports are
 * rate limited on the backend.
 */
export async function apiDownload(endpoint: string, filename: string): Promise<void> {
    const token = getToken();
    let res: Response;
    try {
        res = await fetch(`${API_URL}${endpoint}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    } catch {
        throw new NetworkError("Cannot reach the ThingsString server. Check your connection and try again.");
    }

    if (res.status === 401 && token && typeof window !== "undefined") {
        clearAuth();
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
            const data = await res.json();
            msg = data?.message || data?.error || msg;
        } catch {
            // not JSON
        }
        throw new Error(msg);
    }

    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
