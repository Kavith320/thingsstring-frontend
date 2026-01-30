import DevicesClient from "./DevicesClient";
import { headers } from "next/headers";

async function getDevices() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    // Forward cookies/auth headers if needed, or use service token
    // For now assuming public or simple bearer flow that might need cookie forwarding
    // Ideally this should use the same auth mechanism as the client if possible

    // NOTE: Simple fetch here. In a real app we might need to forward cookies.
    try {
        const res = await fetch(`${API_URL}/api/devices`, {
            method: "GET",
            cache: "no-store", // dynamic
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : data?.devices || [];
    } catch (e) {
        console.error("Failed to fetch devices server-side:", e);
        return [];
    }
}

export default async function DevicesPage() {
    const devices = await getDevices();

    return <DevicesClient initialDevices={devices} />;
}
