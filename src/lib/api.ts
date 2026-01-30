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
        const msg = data?.message || `API error (${res.status})`;
        throw new Error(msg);
    }

    return data as T;
}
