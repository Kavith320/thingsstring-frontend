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
    style: {
        strokeWidth: 4,
        stroke: "#6366f1",
        filter: "drop-shadow(0px 2px 8px rgba(99, 102, 241, 0.5))"
    },
    type: 'default',
    animated: true,
    markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: '#6366f1',
    },
};

function CanvasInner({ devices, initialFlows, onSave, onDelete, viewSwitcher }: AutomationCanvasEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);
    const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
    const [menu, setMenu] = useState<{ id: string; type: 'node' | 'edge'; top?: number; left?: number; right?: number; bottom?: number } | null>(null);
    const [selectedFlowLogs, setSelectedFlowLogs] = useState<string | null>(null);
    const [deployProgress, setDeployProgress] = useState(0);
    const [deployStatus, setDeployStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'loading' } | null>(null);

    const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();
            const pane = reactFlowWrapper.current?.getBoundingClientRect();
            if (!pane) return;

            setMenu({
                id: node.id,
                type: 'node',
                top: event.clientY - pane.top,
                left: event.clientX - pane.left,
            });
        },
        [setMenu]
    );

    const onEdgeContextMenu = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            event.preventDefault();
            const pane = reactFlowWrapper.current?.getBoundingClientRect();
            if (!pane) return;

            setMenu({
                id: edge.id,
                type: 'edge',
                top: event.clientY - pane.top,
                left: event.clientX - pane.left,
            });
        },
        [setMenu]
    );

    const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

    const deleteItem = useCallback(() => {
        if (!menu) return;

        if (menu.type === 'node') {
            const allNodes = getNodes();
            const nodeToDelete = allNodes.find(n => n.id === menu.id);
            if (nodeToDelete?.data?._id) {
                const flowId = String(nodeToDelete.data._id);
                setPendingDeletions(prev => [...prev, flowId]);
            }

            setNodes((nds) => nds.filter((node) => node.id !== menu.id));
            setEdges((eds) => eds.filter((edge) => edge.source !== menu.id && edge.target !== menu.id));
        } else {
            setEdges((eds) => eds.filter((edge) => edge.id !== menu.id));
        }

        setMenu(null);
    }, [menu, getNodes, setNodes, setEdges]);

    const duplicateNode = useCallback(() => {
        if (!menu) return;
        const allNodes = getNodes();
        const node = allNodes.find((n) => n.id === menu.id);
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
    }, [menu, getNodes, setNodes]);

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
    // We hash the entire content of the flows to detect any deep changes
    const flowsHash = JSON.stringify(initialFlows);
    const lastHash = useRef(flowsHash);
    useEffect(() => {
        if (flowsHash !== lastHash.current) {
            console.log("[Canvas] Initial flows changed, resetting load flag...");
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
        // Use getNodes and getEdges to bypass any React state closure issues
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        const sourceNodes = currentNodes.filter(n => n.type === 'source');

        if (sourceNodes.length === 0) {
            setDeployStatus({ message: "Add a trigger source node first!", type: 'info' });
            setTimeout(() => setDeployStatus(null), 3000);
            return;
        }

        setSaving(true);
        setDeployProgress(0);
        setDeployStatus({ message: "Starting deployment...", type: 'loading' });

        try {
            // 1. Process Deletions first
            if (onDelete && pendingDeletions.length > 0) {
                setDeployStatus({ message: "Removing deleted components...", type: 'loading' });
                // Ensure unique IDs
                const uniqueDeletions = Array.from(new Set(pendingDeletions));
                for (let i = 0; i < uniqueDeletions.length; i++) {
                    await onDelete(uniqueDeletions[i]);
                    // Basic progress estimate including deletions
                    setDeployProgress(((i + 1) / (uniqueDeletions.length + sourceNodes.length)) * 100);
                }
                setPendingDeletions([]);
            }

            // 2. Discover all valid paths (Source -> Logic -> Action)
            // This supports 1-to-N (one source to many logics) and N-to-1 (many logics to one action)
            const validPaths: { source: Node; logic: Node; action: Node }[] = [];

            sourceNodes.forEach(source => {
                const edgesFromSource = currentEdges.filter(e => e.source === source.id);

                edgesFromSource.forEach(edgeToLogic => {
                    const logicNode = currentNodes.find(n => n.id === edgeToLogic.target && n.type === 'logic');
                    if (!logicNode) return;

                    const edgesFromLogic = currentEdges.filter(e => e.source === logicNode.id);

                    edgesFromLogic.forEach(edgeToAction => {
                        const actionNode = currentNodes.find(n => n.id === edgeToAction.target && n.type === 'action');
                        if (!actionNode) return;

                        validPaths.push({ source, logic: logicNode, action: actionNode });
                    });
                });
            });

            if (validPaths.length === 0) {
                setDeployStatus({ message: "No complete paths (Source -> Logic -> Action) found.", type: 'info' });
                setTimeout(() => setDeployStatus(null), 3000);
                setSaving(false);
                return;
            }

            // 3. Process each discovered path as a separate flow
            let completed = 0;
            const totalToProcess = validPaths.length;

            for (const path of validPaths) {
                const { source, logic, action } = path;

                // Format for backend with safety fallbacks to avoid 500 errors
                const metricPath = source.data.metricPath || (source.data.options as string[])?.[0] || "";
                const actuatorKey = action.data.actuatorKey || (action.data.options as string[])?.[0] || "";

                if (!metricPath || !actuatorKey) {
                    console.warn(`Skipping incomplete path: ${source.id} -> ${logic.id} -> ${action.id}`);
                    completed++;
                    continue;
                }

                setDeployStatus({ message: `Deploying: ${metricPath} -> ${actuatorKey}`, type: 'loading' });

                // Check for existing _id. If the nodes were loaded from an existing flow, they'll have the same _id.
                // Priority: Use the _id if it's common between source, logic and action
                let existingId = source.data?._id === logic.data?._id && logic.data?._id === action.data?._id ? source.data?._id : null;

                // Fallback: If any node has an _id but it's not a common chain, it's likely a new branch from an old node.
                // In that case, we treat it as a NEW flow if the chain is unique.

                const flowData = {
                    _id: existingId,
                    name: `${metricPath} -> ${actuatorKey} Auto`,
                    deviceId: source.data.deviceId,
                    metricPath: metricPath,
                    condition: logic.data.condition, // Algebraic Operator Logic
                    deltaThreshold: Number(logic.data.deltaThreshold ?? 1.0),
                    intervalSec: Number(logic.data.intervalSec ?? 30),
                    cooldownSec: Number(logic.data.cooldownSec ?? 60),
                    action: {
                        deviceId: action.data.deviceId,
                        actuatorKey: actuatorKey,
                        setValue: action.data.setValue !== undefined ? action.data.setValue : true
                    },
                    enabled: true,
                    // Save Graphic Configurations
                    ui_metadata: {
                        sourcePosition: source.position,
                        logicPosition: logic.position,
                        actionPosition: action.position,
                        // Store small metadata about the architecture
                        nodes: [source.id, logic.id, action.id]
                    }
                };

                console.table({
                    Path: `${source.id} → ${logic.id} → ${action.id}`,
                    Sensor: flowData.deviceId,
                    Actuator: flowData.action.deviceId,
                    Value: flowData.action.setValue
                });

                await onSave(flowData);

                completed++;
                setDeployProgress((completed / totalToProcess) * 100);
            }

            // FORCE REFRESH: This ensures that after a save, the canvas re-loads 
            // everything from the server's single source of truth.
            initialLoadDone.current = false;

            setDeployStatus({ message: "✓ All paths synchronized successfully.", type: 'success' });
            setTimeout(() => {
                setDeployStatus(null);
                setDeployProgress(0);
            }, 4000);

        } catch (err: any) {
            console.error("Deploy Error:", err);
            setDeployStatus({
                message: `Deployment failed: ${err?.message || "Check console"}`,
                type: 'error'
            });
            setTimeout(() => setDeployStatus(null), 6000);
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
                    onEdgeContextMenu={onEdgeContextMenu}
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
                                else {
                                    setDeployStatus({ message: "Deploy your flows first to see execution history.", type: 'info' });
                                    setTimeout(() => setDeployStatus(null), 3000);
                                }
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

                    <Panel position="top-left" className="m-4 flex flex-col gap-3">
                        {/* Live Plain English Logic Summary Banner */}
                        <div className="bg-zinc-900/90 border border-zinc-700/80 text-white backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-[580px] sm:max-w-[700px] border-l-4 border-l-indigo-500">
                            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Live Logic Rule Preview
                                </div>
                                <div className="text-xs font-mono font-medium leading-relaxed mt-0.5">
                                    {(() => {
                                        const sourceNode = nodes.find(n => n.type === 'source');
                                        const logicNode = nodes.find(n => n.type === 'logic');
                                        const actionNode = nodes.find(n => n.type === 'action');

                                        if (!sourceNode && !logicNode && !actionNode) {
                                            return <span className="text-zinc-400">Drag Sensor ➔ Logic ➔ Action nodes onto canvas to create rules</span>;
                                        }

                                        const sourceData = (sourceNode?.data || {}) as any;
                                        const logicData = (logicNode?.data || {}) as any;
                                        const actionData = (actionNode?.data || {}) as any;

                                        const sensorName = String(sourceData.name || "Sensor");
                                        const sensorMetric = String(sourceData.metricPath || "Metric");
                                        const operator = String(logicData.condition?.operator || ">");
                                        const threshold = String(logicData.condition?.value ?? logicData.deltaThreshold ?? 0);
                                        const actuatorName = String(actionData.deviceName || "Actuator");
                                        const actuatorKey = String(actionData.actuatorKey || "Output Pin");
                                        const actuatorState = actionData.setValue ? "ON" : "OFF";

                                        return (
                                            <span className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-extrabold text-indigo-400">IF</span>
                                                <span className="bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30 text-indigo-200">[{sensorName} • {sensorMetric}]</span>
                                                <span className="font-extrabold text-amber-400">IS {operator} {threshold}</span>
                                                <span className="font-extrabold text-emerald-400">➔ THEN SET</span>
                                                <span className="bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30 text-emerald-200">[{actuatorName} • {actuatorKey}]</span>
                                                <span className="font-extrabold text-emerald-300">TO [{actuatorState}]</span>
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {deployStatus && (
                            <div className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-2xl border animate-in slide-in-from-left-4 duration-300 shadow-lg backdrop-blur-md max-w-[320px]",
                                deployStatus.type === 'loading' && "bg-indigo-50/90 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400",
                                deployStatus.type === 'success' && "bg-emerald-50/90 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400",
                                deployStatus.type === 'error' && "bg-red-50/90 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400",
                                deployStatus.type === 'info' && "bg-blue-50/90 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
                            )}>
                                {deployStatus.type === 'loading' && <div className="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />}
                                {deployStatus.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                {deployStatus.type === 'error' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                                {deployStatus.type === 'info' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                <span className="text-[11px] font-bold leading-tight">{deployStatus.message}</span>
                            </div>
                        )}
                    </Panel>

                    {/* Thin Progress Bar */}
                    {saving && (
                        <div className="absolute top-0 left-0 w-full h-1 z-[100] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                style={{ width: `${deployProgress}%` }}
                            />
                        </div>
                    )}

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
                                    deleteItem();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group"
                            >
                                <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg group-hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </div>
                                Remove {menu.type === 'node' ? 'Node' : 'Connection'}
                            </button>

                            {menu.type === 'node' && (
                                <>
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

                                    {nodes.find(n => n.id === menu?.id)?.data?._id && (
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
                                </>
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
