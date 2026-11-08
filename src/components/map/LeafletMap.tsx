"use client";

/**
 * Leaflet + OpenStreetMap map. Client-only: import it with next/dynamic and { ssr: false }.
 * Markers are drawn as coloured dots (divIcon), so no marker image files are needed.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    color?: string | null;
    online?: boolean;
    title: string;
    subtitle?: string;
    href?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function dotIcon(color: string, online: boolean, big = false) {
    const size = big ? 22 : 18;
    return L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${online ? color : "#a1a1aa"};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    });
}

export default function LeafletMap({
    markers = [],
    picked,
    onPick,
    className,
    defaultCenter = [7.8731, 80.7718], // Sri Lanka
    defaultZoom = 7,
}: {
    markers?: MapMarker[];
    /** a single editable point (location picker) */
    picked?: { lat: number; lng: number } | null;
    onPick?: (lat: number, lng: number) => void;
    className?: string;
    defaultCenter?: [number, number];
    defaultZoom?: number;
}) {
    const elRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const pickRef = useRef<L.Marker | null>(null);
    const onPickRef = useRef(onPick);
    onPickRef.current = onPick;
    const fittedRef = useRef(false);

    // Create the map once
    useEffect(() => {
        if (!elRef.current || mapRef.current) return;
        const map = L.map(elRef.current, { zoomControl: true, attributionControl: true }).setView(defaultCenter, defaultZoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        map.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)));
        mapRef.current = map;
        // The container may still be sizing (modal animation, flex layout)
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(elRef.current);
        return () => {
            ro.disconnect();
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
    }, []);

    // Device markers
    useEffect(() => {
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();
        for (const m of markers) {
            const marker = L.marker([m.lat, m.lng], { icon: dotIcon(m.color || "#6366f1", m.online !== false), title: m.title, keyboard: true });
            const status = m.online === undefined ? "" : `<span style="color:${m.online ? "#059669" : "#71717a"};font-weight:600">${m.online ? "Online" : "Offline"}</span>`;
            marker.bindPopup(
                `<div style="min-width:150px"><div style="font-weight:600;font-size:14px">${esc(m.title)}</div>` +
                    (m.subtitle ? `<div style="color:#71717a;font-size:12px">${esc(m.subtitle)}</div>` : "") +
                    (status ? `<div style="font-size:12px;margin-top:2px">${status}</div>` : "") +
                    (m.href ? `<a href="${esc(m.href)}" style="display:inline-block;margin-top:6px;font-weight:600">Open device →</a>` : "") +
                    `</div>`
            );
            marker.addTo(layer);
        }
        if (!fittedRef.current && markers.length) {
            fittedRef.current = true;
            if (markers.length === 1) map.setView([markers[0].lat, markers[0].lng], 14);
            else map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
        }
    }, [markers]);

    // Picked point (location picker)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!picked) {
            pickRef.current?.remove();
            pickRef.current = null;
            return;
        }
        if (!pickRef.current) {
            pickRef.current = L.marker([picked.lat, picked.lng], { icon: dotIcon("#6366f1", true, true), draggable: true }).addTo(map);
            pickRef.current.on("dragend", () => {
                const p = pickRef.current!.getLatLng();
                onPickRef.current?.(+p.lat.toFixed(6), +p.lng.toFixed(6));
            });
            if (!fittedRef.current) {
                fittedRef.current = true;
                map.setView([picked.lat, picked.lng], 15);
            }
        } else {
            pickRef.current.setLatLng([picked.lat, picked.lng]);
        }
        // Follow points set from outside the map (typed in, or "use my location")
        if (!map.getBounds().contains([picked.lat, picked.lng])) map.setView([picked.lat, picked.lng], Math.max(map.getZoom(), 15));
    }, [picked]);

    return <div ref={elRef} className={className} style={{ zIndex: 0 }} />;
}
