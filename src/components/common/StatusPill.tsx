import { cn } from "@/lib/utils";

/** Online/offline badge. Always shows text, not just a colour. */
export default function StatusPill({ online, className }: { online: boolean; className?: string }) {
    return (
        <span className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            online
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
            className
        )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-emerald-500" : "bg-zinc-400")} />
            {online ? "Online" : "Offline"}
        </span>
    );
}
