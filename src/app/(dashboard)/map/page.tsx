"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Radio } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { deviceDisplayName, deviceId, deviceOnline, deviceUi } from "@/lib/deviceUi";
import { formatLastSeen, getLastTelemetryMs } from "@/lib/utils";
import StatusPill from "@/components/common/StatusPill";
import { IconBadge, Notice } from "@/components/common/ui";
import type { MapMarker } from "@/components/map/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
    ssr: false,
    loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Loading map…</div>,
});

export default function MapPage() {
    const [devices, setDevices] = useState<any[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        const load = () =>
            apiRequest("/api/devices")
                .then((r: any) => {
                    if (!alive) return;
                    setDevices(Array.isArray(r) ? r : r?.devices || []);
                    setError("");
                })
                .catch((e) => alive && setError(e.message || "Couldn't load devices"));
        load();
        const t = setInterval(load, 30_000); // status only; positions rarely change
        return () => {
            alive = false;
            clearInterval(t);
        };
    }, []);

    const { located, unlocated, supported } = useMemo(() => {
        const list = devices || [];
        return {
            located: list.filter((d) => deviceUi(d).location),
            unlocated: list.filter((d) => !deviceUi(d).location),
            // older backends don't send `ui` at all
            supported: list.length === 0 || list.some((d) => d && "ui" in d),
        };
    }, [devices]);

    const markers: MapMarker[] = useMemo(
        () =>
            located.map((d) => {
                const ui = deviceUi(d);
                return {
                    id: deviceId(d),
                    lat: ui.location!.lat,
                    lng: ui.location!.lng,
                    color: ui.color,
                    online: deviceOnline(d),
                    title: deviceDisplayName(d),
                    subtitle: ui.location!.label || undefined,
                    href: `/devices/${encodeURIComponent(deviceId(d))}`,
                };
            }),
        [located]
    );

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Map</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Where your devices are. Grey dots are offline.</p>
            </div>

            {error && <Notice tone="warning">{error}</Notice>}
            {!supported && <Notice tone="warning">Your server doesn&apos;t support device locations yet. Update the backend to use the map.</Notice>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="h-[55dvh] min-h-72 min-w-0 overflow-hidden rounded-2xl border border-zinc-200 lg:h-[calc(100dvh-14rem)] dark:border-zinc-800">
                    <LeafletMap markers={markers} className="h-full w-full" />
                </div>

                <div className="space-y-4">
                    <section>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">On the map <span className="font-normal text-zinc-500">{located.length}</span></h3>
                        {devices === null ? (
                            <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                        ) : located.length === 0 ? (
                            <Notice>No device has a location yet.</Notice>
                        ) : (
                            <ul className="space-y-2">
                                {located.map((d) => <DeviceRow key={deviceId(d)} d={d} />)}
                            </ul>
                        )}
                    </section>

                    {unlocated.length > 0 && supported && (
                        <section>
                            <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">No location <span className="font-normal text-zinc-500">{unlocated.length}</span></h3>
                            <p className="mb-2 text-xs text-zinc-500">Open a device, tap <b>Customise</b>, then <b>Location</b>.</p>
                            <ul className="space-y-2">
                                {unlocated.map((d) => <DeviceRow key={deviceId(d)} d={d} />)}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

function DeviceRow({ d }: { d: any }) {
    const ui = deviceUi(d);
    const last = getLastTelemetryMs(d?.last_telemetry);
    return (
        <li>
            <Link
                href={`/devices/${encodeURIComponent(deviceId(d))}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
            >
                <IconBadge icon={ui.icon} color={ui.color} fallback={Radio} size="sm" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{deviceDisplayName(d)}</div>
                    <div className="flex items-center gap-1 truncate text-xs text-zinc-500">
                        {ui.location ? <><MapPin className="h-3 w-3 shrink-0" />{ui.location.label || `${ui.location.lat.toFixed(4)}, ${ui.location.lng.toFixed(4)}`}</> : `Last seen ${formatLastSeen(last)}`}
                    </div>
                </div>
                <StatusPill online={deviceOnline(d)} />
            </Link>
        </li>
    );
}
