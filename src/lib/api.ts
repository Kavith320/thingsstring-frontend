import { getToken } from "@/lib/auth/storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestOptions {
    method?: string;
    body?: any;
}

export async function apiRequest<T = any>(
    endpoint: string,
    { method = "GET", body }: RequestOptions = {}
): Promise<T> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
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
        console.error(`API Error (${res.status}):`, msg);
        throw new Error(msg);
    }

    return data as T;
}
