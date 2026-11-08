"use client";

/** Small shared form/UI primitives so pages look and behave the same. */
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ImagePlus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, apiUpload } from "@/lib/api";
import { resizeImage } from "@/lib/image";
import { ALL_ICONS, COLORS, EMOJIS, ICON_CATEGORIES, IconRef } from "@/lib/icons";

/* ---------------- Button ---------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
    variant = "secondary",
    className,
    loading,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
    return (
        <button
            type="button"
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
                variant === "primary" && "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
                variant === "secondary" && "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                variant === "ghost" && "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                variant === "danger" && "border border-red-500/30 bg-red-500/5 text-red-600 hover:bg-red-500/10 dark:text-red-400",
                className
            )}
        >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {children}
        </button>
    );
}

/* ---------------- Fields ---------------- */
export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: (id: string) => React.ReactNode; className?: string }) {
    const id = useId();
    return (
        <div className={className}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
            {children(id)}
            {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
        </div>
    );
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={cn(inputCls, "h-11", className)} />;
});

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={cn(inputCls, "min-h-24 py-2.5", className)} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={cn(inputCls, "h-11", className)} />;
}

/* ---------------- Notice ---------------- */
export function Notice({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode; className?: string }) {
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cn(
                "rounded-xl border px-3 py-2.5 text-sm",
                tone === "info" && "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                tone === "success" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                tone === "error" && "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
                tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                className
            )}
        >
            {children}
        </div>
    );
}

/* ---------------- Modal (bottom sheet on phones) ---------------- */
export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    wide,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    wide?: boolean;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    // Parents usually pass an inline onClose (a new function every render). Keep it in a ref so
    // the effect below runs only when the modal opens; re-running it on each keystroke moved
    // focus back to the panel and out of whatever text box the user was typing in.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
        document.addEventListener("keydown", onKey);
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={cn(
                    "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-zinc-950 sm:rounded-2xl sm:border sm:border-zinc-200 dark:sm:border-zinc-800",
                    wide ? "sm:max-w-3xl" : "sm:max-w-lg"
                )}
            >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:px-6">
                    <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800 sm:px-6">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}

/* ---------------- Colour picker ---------------- */
export function ColorPicker({ value, onChange, label = "Colour" }: { value: string | null; onChange: (v: string | null) => void; label?: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            <button
                type="button"
                role="radio"
                aria-checked={!value}
                aria-label="No colour"
                onClick={() => onChange(null)}
                className={cn("grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600", !value && "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950")}
            >
                <X className="h-4 w-4" />
            </button>
            {COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={value?.toLowerCase() === c}
                    aria-label={c}
                    onClick={() => onChange(c)}
                    style={{ background: c }}
                    className={cn("grid h-9 w-9 place-items-center rounded-full text-white", value?.toLowerCase() === c && "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950")}
                >
                    {value?.toLowerCase() === c && <Check className="h-4 w-4" />}
                </button>
            ))}
        </div>
    );
}

/* ---------------- Icon picker ---------------- */
interface UploadedIcon { id: string; ref: string; url: string }

export function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
    const [tab, setTab] = useState<"icons" | "emoji" | "uploads">(value?.startsWith("emoji:") ? "emoji" : value?.startsWith("file:") ? "uploads" : "icons");
    const [uploads, setUploads] = useState<UploadedIcon[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const q = query.trim().toLowerCase();
    const iconList = q
        ? ALL_ICONS.filter((i) => i.name.includes(q) || i.ref.includes(q))
        : category === "all"
          ? ALL_ICONS
          : ICON_CATEGORIES.find((c) => c.id === category)?.icons || [];

    useEffect(() => {
        if (tab !== "uploads" || uploads) return;
        apiRequest("/api/files/icons", { quiet: true })
            .then((r: any) => setUploads(r?.icons || []))
            .catch((e) => {
                setUploads([]);
                setError(e.message || "Couldn't load your icons");
            });
    }, [tab, uploads]);

    async function upload(file: File) {
        setBusy(true);
        setError("");
        try {
            const blob = await resizeImage(file, 128, { square: true });
            const r: any = await apiUpload("/api/files/icons", blob, "POST");
            setUploads((u) => [r.icon, ...(u || [])]);
            onChange(r.icon.ref);
        } catch (e: any) {
            setError(e.message || "Upload failed");
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function remove(icon: UploadedIcon) {
        setError("");
        try {
            await apiRequest(`/api/files/icons/${icon.id}`, { method: "DELETE" });
            setUploads((u) => (u || []).filter((x) => x.id !== icon.id));
            if (value === icon.ref) onChange(null);
        } catch (e: any) {
            setError(e.message || "Couldn't delete that icon");
        }
    }

    const tile = (selected: boolean) =>
        cn(
            "grid h-11 w-11 place-items-center rounded-xl border text-zinc-700 transition dark:text-zinc-200",
            selected ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        );

    return (
        <div>
            <div className="mb-3 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" role="tablist">
                {(["icons", "emoji", "uploads"] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={tab === t}
                        onClick={() => setTab(t)}
                        className={cn("h-9 flex-1 rounded-md text-sm font-semibold capitalize", tab === t ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500")}
                    >
                        {t === "uploads" ? "My images" : t}
                    </button>
                ))}
            </div>

            {tab === "icons" && (
                <div className="mb-2 space-y-2">
                    <label className="relative block">
                        <span className="sr-only">Search icons</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search icons (pump, cow, solar…)"
                            className={cn(inputCls, "h-10 pl-9")}
                        />
                    </label>
                    {!q && (
                        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Icon categories">
                            {[{ id: "all", label: "All" }, ...ICON_CATEGORIES].map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={category === c.id}
                                    onClick={() => setCategory(c.id)}
                                    className={cn(
                                        "h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold",
                                        category === c.id
                                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                                            : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                                    )}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto p-0.5">
                <button type="button" onClick={() => onChange(null)} className={tile(!value)} aria-label="No icon" title="Default">
                    <X className="h-4 w-4" />
                </button>
                {tab === "icons" &&
                    iconList.map((i) => (
                        <button key={i.ref} type="button" onClick={() => onChange(i.ref)} className={tile(value === i.ref)} aria-label={i.name} title={i.name}>
                            <i.Icon className="h-5 w-5" aria-hidden />
                        </button>
                    ))}
                {tab === "icons" && iconList.length === 0 && <span className="self-center text-sm text-zinc-500">No icons match “{query}”.</span>}
                {tab === "emoji" &&
                    EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => onChange(`emoji:${e}`)} className={cn(tile(value === `emoji:${e}`), "text-xl")} aria-label={e}>
                            {e}
                        </button>
                    ))}
                {tab === "uploads" && (
                    <>
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={cn(tile(false), "border-dashed")} aria-label="Upload an image" title="Upload (PNG, JPEG or WebP)">
                            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ImagePlus className="h-5 w-5" />}
                        </button>
                        {uploads === null && <span className="self-center text-sm text-zinc-500">Loading…</span>}
                        {(uploads || []).map((ic) => (
                            <div key={ic.id} className="group relative">
                                <button type="button" onClick={() => onChange(ic.ref)} className={cn(tile(value === ic.ref), "overflow-hidden p-1")} aria-label="Use uploaded image">
                                    <IconRef value={ic.ref} className="h-full w-full rounded-lg" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(ic)}
                                    aria-label="Delete uploaded image"
                                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white shadow sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    </>
                )}
            </div>
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}

/** Icon in a tinted rounded square, using the item's colour when set. */
export function IconBadge({ icon, color, fallback, size = "md", className }: { icon?: string | null; color?: string | null; fallback?: any; size?: "sm" | "md" | "lg"; className?: string }) {
    const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
    const glyph = size === "sm" ? "h-4 w-4 text-base" : size === "lg" ? "h-6 w-6 text-2xl" : "h-5 w-5 text-xl";
    return (
        <span
            className={cn("grid shrink-0 place-items-center overflow-hidden", box, !color && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", className)}
            style={color ? { background: `${color}1f`, color } : undefined}
        >
            <IconRef value={icon} fallback={fallback} className={icon?.startsWith("file:") ? "h-full w-full" : glyph} />
        </span>
    );
}
