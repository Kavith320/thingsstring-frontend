"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
    Zap,
    Network
} from "lucide-react";
import LoadingSignal from "@/components/LoadingSignal";
import dynamic from "next/dynamic";

const AutomationCanvas = dynamic(() => import("@/components/automation/AutomationCanvas"), {
    ssr: false,
});

import type { Device } from "@/types/automation";

export default function AutomationPage() {
    const [flows, setFlows] = useState<any[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function fetchData() {
        try {
            const [devicesData, flowsData] = await Promise.all([
                apiRequest("/api/devices"),
                apiRequest("/api/automation/flows")
            ]);
            setDevices(devicesData.devices || devicesData || []);
            setFlows(flowsData.flows || []);
        } catch (e: any) {
            setError(e.message || "Failed to load automation data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    async function saveFlowFromCanvas(flowData: any) {
        try {
            const isUpdate = !!flowData._id;
            const url = isUpdate
                ? `/api/automation/flows/${flowData._id}`
                : "/api/automation/flows";

            const { _id, ...body } = flowData;

            console.log(`🚀 [Deployment] ${isUpdate ? 'Updating' : 'Creating'} flow...`);
            console.log(`🔗 API URL: ${url}`);
            console.log("📦 Payload:", JSON.stringify(body, null, 2));

            await apiRequest(url, {
                method: isUpdate ? "PUT" : "POST",
                body: body
            });
            await fetchData(); // Refresh data to get correct IDs fo new nodes
        } catch (e: any) {
            console.error("Failed to deploy flow from canvas", e);
            throw e;
        }
    }

    async function deleteFlow(flowId: string) {
        try {
            await apiRequest(`/api/automation/flows/${flowId}`, {
                method: "DELETE"
            });
            await fetchData();
        } catch (e: any) {
            console.error("Failed to delete flow", e);
            throw e;
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingSignal size="lg" />
                <p className="mt-4 text-zinc-500 animate-pulse font-medium">Booting Automation Engine...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400">
                    <h3 className="text-xl font-bold mb-2">Engine Sync Error</h3>
                    <p className="text-sm opacity-80 mb-6">{error}</p>
                    <button
                        onClick={() => fetchData()}
                        className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                    >
                        Retry Sync
                    </button>
                </div>
            </div>
        );
    }

    return (
        /* Global override to allow the designer to fill the entire dashboard width */
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                main > div { max-width: none !important; width: 100% !important; margin: 0 !important; }
            `}} />

            <div className="relative h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 flex flex-col overflow-hidden bg-white dark:bg-zinc-950 rounded-t-3xl border-x border-t border-zinc-200 dark:border-zinc-800 shadow-2xl">
                {/* Designer Header */}
                <div className="h-[56px] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight dark:text-white line-height-none">Automation Designer</h1>
                            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest leading-none mt-0.5">Visual Flow Engine v2.0</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ENGINE ONLINE
                        </div>
                    </div>
                </div>

                {/* Designer Viewport */}
                <div className="flex-1 min-h-0">
                    <AutomationCanvas
                        devices={devices}
                        initialFlows={flows}
                        onSave={saveFlowFromCanvas}
                        onDelete={deleteFlow}
                    />
                </div>
            </div>
        </>
    );
}
