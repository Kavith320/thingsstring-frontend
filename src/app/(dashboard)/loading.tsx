import LoadingSignal from "@/components/LoadingSignal";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-50/10 dark:bg-zinc-950/10 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500">
            <LoadingSignal size="lg" />
        </div>
    );
}
