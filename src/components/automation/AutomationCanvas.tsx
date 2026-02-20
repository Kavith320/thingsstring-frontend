"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Background,
    Controls,
    MiniMap,
    Panel,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    useReactFlow,
    MarkerType
} from "@xyflow/react";

import CanvasSidebar from "./CanvasSidebar";
import SourceNode from "./nodes/SourceNode";
import LogicNode from "./nodes/LogicNode";
import ActionNode from "./nodes/ActionNode";
import FlowLogsModal from "./FlowLogsModal";
import { Save, Trash2, Zap, Play, Info, Copy, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/types/automation";

const nodeTypes = {
    source: SourceNode,
    logic: LogicNode,
    action: ActionNode,
};

let id = 0;
const getId = () => `node_${id++}`;

interface AutomationCanvasEditorProps {
    devices: Device[];
    initialFlows?: any[];
    onSave: (flowData: any) => Promise<void>;
    onDelete?: (flowId: string) => Promise<void>;
    viewSwitcher?: React.ReactNode;
}

const defaultEdgeOptions = {
    style: { strokeWidth: 4, stroke: "#6366f1" },
    type: 'default',
    animated: true,
    markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: '#6366f1',
    },
};

function CanvasInner({ devices, initialFlows, onSave, onDelete, viewSwitcher }: AutomationCanvasEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);
    const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
    const [menu, setMenu] = useState<{ id: string; top?: number; left?: number; right?: number; bottom?: number } | null>(null);
    const [selectedFlowLogs, setSelectedFlowLogs] = useState<string | null>(null);

    const { screenToFlowPosition, fitView } = useReactFlow();

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();
            const pane = reactFlowWrapper.current?.getBoundingClientRect();
            if (!pane) return;

            setMenu({
                id: node.id,
                top: event.clientY - pane.top,
                left: event.clientX - pane.left,
            });
        },
        [setMenu]
    );

    const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

    const deleteNode = useCallback(() => {
        if (!menu) return;

        const nodeToDelete = nodes.find(n => n.id === menu.id);
        if (nodeToDelete?.data?._id) {
            const flowId = String(nodeToDelete.data._id);
            setPendingDeletions(prev => [...prev, flowId]);
        }

        setNodes((nds) => nds.filter((node) => node.id !== menu.id));
        setEdges((eds) => eds.filter((edge) => edge.source !== menu.id && edge.target !== menu.id));
        setMenu(null);
    }, [menu, nodes, setNodes, setEdges]);

    const duplicateNode = useCallback(() => {
        if (!menu) return;
        const node = nodes.find((n) => n.id === menu.id);
        if (node) {
            const newNode = {
                ...node,
                id: `${node.id}_copy_${Math.random().toString(36).substr(2, 5)}`,
                position: {
                    x: node.position.x + 50,
                    y: node.position.y + 50,
                },
                selected: false,
                data: { ...node.data, _id: undefined },
            };
            setNodes((nds) => nds.concat(newNode));
        }
        setMenu(null);
    }, [menu, nodes, setNodes]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const initialLoadDone = useRef(false);

    // Load initial flows onto canvas
    useEffect(() => {
        if (!initialFlows || initialFlows.length === 0 || initialLoadDone.current) return;

        // Wait for devices to be available to ensure correct labels/options
        if (!devices || devices.length === 0) return;

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        initialFlows.forEach((flow, index) => {
            const yOffset = index * 250;
            const flowId = flow._id || `initial_${index}`;

            const sourceId = `source_${flowId}`;
            const logicId = `logic_${flowId}`;
            const actionId = `action_${flowId}`;

            // Look up device info to enrich node data
            const sourceDevice = devices.find(d => d.deviceId === flow.deviceId);

            // STRICT LOOKUP: Only fallback to sensor ID if that device actually has actuators.
            // This prevents "Actuator is a sensor" bug where a missing action.deviceId 
            // gets permanently replaced by the sensor's hub ID during a save cycle.
            const actionTarget = flow.action || {};
            let actionDeviceId = actionTarget.deviceId;

            if (!actionDeviceId) {
                const triggerHasActuators = sourceDevice?.config?.actuators && Object.keys(sourceDevice.config.actuators).length > 0;
                if (triggerHasActuators) {
                    actionDeviceId = flow.deviceId;
                }
            }

            const actionDevice = devices.find(d => d.deviceId === actionDeviceId);

            const sourceName =
                sourceDevice?.config?.device?.name ||
                sourceDevice?.name ||
                flow.deviceId ||
                "Sensor Node";

            const actionName =
                actionDevice?.config?.device?.name ||
                actionDevice?.name ||
                (actionDeviceId ? actionDeviceId : "Unassigned Actuator");

            const sourceOptions = sourceDevice?.last_telemetry
                ? Object.keys(sourceDevice.last_telemetry).filter(k => !['_id', 'ts', 'timestamp', 'updatedAt', 'createdAt', '__v', 'actuators'].includes(k))
                : [];

            const actionOptions = actionDevice?.config?.actuators ? Object.keys(actionDevice.config.actuators) : [];

            // 1. Source Node
            newNodes.push({
                id: sourceId,
                type: 'source',
                position: flow.ui_metadata?.sourcePosition || { x: 50, y: 100 + yOffset },
                data: {
                    _id: flow._id,
                    name: sourceName,
                    deviceId: flow.deviceId,
                    options: sourceOptions,
                    metricPath: flow.metricPath
                }
            });

            // 2. Logic Node
            newNodes.push({
                id: logicId,
                type: 'logic',
                position: flow.ui_metadata?.logicPosition || { x: 350, y: 100 + yOffset },
                data: {
                    _id: flow._id,
                    condition: flow.condition,
                    deltaThreshold: flow.deltaThreshold,
                    intervalSec: flow.intervalSec,
                    cooldownSec: flow.cooldownSec
                }
            });

            // 3. Action Node
            newNodes.push({
                id: actionId,
                type: 'action',
                position: flow.ui_metadata?.actionPosition || { x: 650, y: 100 + yOffset },
                data: {
                    _id: flow._id,
                    deviceName: actionName,
                    deviceId: actionDeviceId,
                    options: actionOptions,
                    actuatorKey: flow.action.actuatorKey,
                    setValue: flow.action.setValue
                }
            });

            // Edges
            newEdges.push({
                id: `e_${sourceId}_${logicId}`,
                source: sourceId,
                target: logicId
            });
            newEdges.push({
                id: `e_${logicId}_${actionId}`,
                source: logicId,
                target: actionId
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
        initialLoadDone.current = true;

        // Only fit view on the very first load to prevent annoying jumps while editing
        setTimeout(() => {
            fitView({ padding: 0.5 });
        }, 300);
    }, [initialFlows, devices, setNodes, setEdges, fitView]);

    // Reset initial load if we get a whole new set of flows from the server (e.g. after deploy)
    const flowsHash = JSON.stringify(initialFlows?.map(f => f._id));
    const lastHash = useRef(flowsHash);
    useEffect(() => {
        if (flowsHash !== lastHash.current) {
            initialLoadDone.current = false;
            lastHash.current = flowsHash;
        }
    }, [flowsHash]);

    // Sync node options when devices list updates
    useEffect(() => {
        if (!devices || devices.length === 0 || nodes.length === 0) return;

        setNodes(nds => nds.map(node => {
            if (node.type === 'source') {
                const device = devices.find(d => d.deviceId === node.data.deviceId);
                const opts = device?.last_telemetry
                    ? Object.keys(device.last_telemetry).filter(k => !['_id', 'ts', 'timestamp', 'updatedAt', 'createdAt', '__v', 'actuators'].includes(k))
                    : [];
                if (JSON.stringify(opts) !== JSON.stringify(node.data.options)) {
                    return { ...node, data: { ...node.data, options: opts } };
                }
            }
            if (node.type === 'action') {
                const device = devices.find(d => d.deviceId === node.data.deviceId);
                const opts = device?.config?.actuators ? Object.keys(device.config.actuators) : [];
                if (JSON.stringify(opts) !== JSON.stringify(node.data.options)) {
                    return { ...node, data: { ...node.data, options: opts } };
                }
            }
            return node;
        }));
    }, [devices, setNodes]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData("application/reactflow");
            const dataStr = event.dataTransfer.getData("application/reactflow-data");

            if (typeof type === "undefined" || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: getId(),
                type,
                position,
                data: JSON.parse(dataStr),
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    const handleSave = async () => {
        // Find valid chains: Source -> Logic -> Action
        // This is a simplified version for MVP
        const sourceNodes = nodes.filter(n => n.type === 'source');

        if (sourceNodes.length === 0) {
            alert("Add a trigger source node first!");
            return;
        }

        setSaving(true);
        try {
            // 1. Process Deletions first
            if (onDelete && pendingDeletions.length > 0) {
                // Ensure unique IDs
                const uniqueDeletions = Array.from(new Set(pendingDeletions));
                for (const flowId of uniqueDeletions) {
                    await onDelete(flowId);
                }
                setPendingDeletions([]);
            }

            // 2. Process Upserts (Current nodes on canvas)
            // Process each source node as a separate flow
            for (const source of sourceNodes) {
                const edgeToLogic = edges.find(e => e.source === source.id);
                if (!edgeToLogic) continue;

                const logicNode = nodes.find(n => n.id === edgeToLogic.target && n.type === 'logic');
                if (!logicNode) continue;

                const edgeToAction = edges.find(e => e.source === logicNode.id);
                if (!edgeToAction) continue;

                const actionNode = nodes.find(n => n.id === edgeToAction.target && n.type === 'action');
                if (!actionNode) continue;

                // Format for backend with safety fallbacks to avoid 500 errors
                const metricPath = source.data.metricPath || (source.data.options as string[])?.[0] || "";
                const actuatorKey = actionNode.data.actuatorKey || (actionNode.data.options as string[])?.[0] || "";

                if (!metricPath || !actuatorKey) {
                    console.warn(`Skipping incomplete flow: ${source.id}`);
                    continue;
                }

                const flowData = {
                    _id: source.data?._id, // Extract ID if it exists
                    name: `${metricPath} -> ${actuatorKey} Auto`,
                    deviceId: source.data.deviceId,
                    metricPath: metricPath,
                    condition: logicNode.data.condition, // Algebraic Operator Logic
                    deltaThreshold: Number(logicNode.data.deltaThreshold ?? 1.0),
                    intervalSec: Number(logicNode.data.intervalSec ?? 30),
                    cooldownSec: Number(logicNode.data.cooldownSec ?? 60),
                    action: {
                        deviceId: actionNode.data.deviceId,
                        actuatorKey: actuatorKey,
                        setValue: actionNode.data.setValue ?? true
                    },
                    enabled: true,
                    // Save Graphic Configurations
                    ui_metadata: {
                        sourcePosition: source.position,
                        logicPosition: logicNode.position,
                        actionPosition: actionNode.position,
                        // Store small metadata about the architecture
                        nodes: [source.id, logicNode.id, actionNode.id]
                    }
                };

                const { _id: flowId, ...payload } = flowData;
                console.log(`[Flow ${flowId || 'NEW'}] Deploying:`, payload);
                await onSave(flowData);
            }
            alert("✓ All flows synchronized with the hardware engine.");
        } catch (err) {
            console.error("Deploy Error:", err);
            alert("Failed to save some flows. Check console for details.");
        } finally {
            setSaving(false);
        }
    };

    const clearCanvas = () => {
        if (confirm("Clear all nodes? (This will delete existing flows from database on next Deploy)")) {
            const idsWithBackendId = nodes
                .map(n => n.data?._id)
                .filter(Boolean) as string[];

            if (idsWithBackendId.length > 0) {
                setPendingDeletions(prev => [...prev, ...idsWithBackendId.map(id => String(id))]);
            }

            setNodes([]);
            setEdges([]);
        }
    };

    return (
        <div className="flex w-full h-full bg-zinc-50 dark:bg-[#09090b]">
            <CanvasSidebar devices={devices} />

            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    onNodeContextMenu={onNodeContextMenu}
                    onPaneClick={onPaneClick}
                    colorMode="system"
                    fitView
                    minZoom={0.2}
                    maxZoom={1.5}
                    fitViewOptions={{ padding: 0.5 }}
                >
                    <Background
                        variant={BackgroundVariant.Lines}
                        gap={40}
                        size={1}
                        color="#E2E8F0"
                        className="dark:!opacity-[0.03] !opacity-[0.5]"
                    />
                    <Controls className="!m-4 !bg-white dark:!bg-zinc-900 !border-zinc-200 dark:!border-zinc-800 rounded-2xl shadow-xl" />

                    <Panel position="top-right" className="m-4 flex gap-3">
                        <button
                            onClick={clearCanvas}
                            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center gap-2 font-bold text-xs"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear
                        </button>
                        <button
                            onClick={() => {
                                // Find any node with an ID to open general history
                                const anySavedNode = nodes.find(n => n.data?._id);
                                if (anySavedNode) setSelectedFlowLogs(String(anySavedNode.data._id));
                                else alert("Deploy your flows first to see execution history.");
                            }}
                            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 font-bold text-xs"
                        >
                            <History className="w-4 h-4 text-indigo-500" />
                            History
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 font-bold text-sm"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Deploy Flows
                        </button>
                    </Panel>

                    <Panel position="top-left" className="m-4">
                        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold dark:text-zinc-200 uppercase tracking-widest">Visual Editor v2.0</span>
                            </div>
                        </div>
                    </Panel>

                    <Panel position="bottom-left" className="m-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-indigo-500 font-medium">
                            <Info className="w-3 h-3" />
                            Wire pattern: Sensor Node ➔ Logic Node ➔ Action Node
                        </div>
                    </Panel>

                    {menu && (
                        <div
                            style={{ top: menu.top, left: menu.left }}
                            className="absolute z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 min-w-[180px] animate-in fade-in zoom-in duration-200"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateNode();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all group"
                            >
                                <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                    <Copy className="w-3.5 h-3.5" />
                                </div>
                                Duplicate Node
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNode();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group"
                            >
                                <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg group-hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </div>
                                Remove Node
                            </button>

                            {nodes.find(n => n.id === menu.id)?.data?._id && (
                                <div className="mt-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const node = nodes.find(n => n.id === menu.id);
                                            if (node?.data?._id) setSelectedFlowLogs(String(node.data._id));
                                            setMenu(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all group"
                                    >
                                        <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                            <History className="w-3.5 h-3.5" />
                                        </div>
                                        Execution Logs
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedFlowLogs && (
                        <FlowLogsModal
                            flowId={selectedFlowLogs}
                            onClose={() => setSelectedFlowLogs(null)}
                        />
                    )}
                </ReactFlow>
            </div>
        </div>
    );
}

export default function AutomationCanvas(props: AutomationCanvasEditorProps) {
    return (
        <div className="w-full h-full border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm relative overflow-hidden">
            <ReactFlowProvider>
                <CanvasInner {...props} />
            </ReactFlowProvider>
        </div>
    );
}
