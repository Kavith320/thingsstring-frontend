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
import { Save, Trash2, Zap, Play, Info } from "lucide-react";
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

function CanvasInner({ devices, initialFlows, onSave, viewSwitcher }: AutomationCanvasEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);

    const { screenToFlowPosition, fitView } = useReactFlow();

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Load initial flows onto canvas
    useEffect(() => {
        if (!initialFlows || initialFlows.length === 0) return;

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        initialFlows.forEach((flow, index) => {
            const yOffset = index * 250;
            const flowId = flow._id || `initial_${index}`;

            const sourceId = `source_${flowId}`;
            const logicId = `logic_${flowId}`;
            const actionId = `action_${flowId}`;

            // 1. Source Node
            newNodes.push({
                id: sourceId,
                type: 'source',
                position: flow.ui_metadata?.sourcePosition || { x: 50, y: 100 + yOffset },
                data: {
                    _id: flow._id,
                    deviceId: flow.deviceId,
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
                    deviceId: flow.action.deviceId || flow.deviceId,
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

        // Only fit view on the very first load to prevent annoying jumps while editing
        if (nodes.length === 0) {
            setTimeout(() => {
                fitView();
            }, 300);
        }
    }, [initialFlows, setNodes, setEdges, nodes.length, fitView]);

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

                // Format for backend
                const flowData = {
                    _id: source.data?._id, // Extract ID if it exists
                    name: `${source.data.metricPath} -> ${actionNode.data.actuatorKey} Auto`,
                    deviceId: source.data.deviceId,
                    metricPath: source.data.metricPath,
                    deltaThreshold: logicNode.data.deltaThreshold,
                    intervalSec: logicNode.data.intervalSec,
                    cooldownSec: logicNode.data.cooldownSec,
                    action: {
                        deviceId: actionNode.data.deviceId,
                        actuatorKey: actionNode.data.actuatorKey,
                        setValue: actionNode.data.setValue
                    },
                    enabled: true,
                    // Save Graphic Configurations
                    ui_metadata: {
                        sourcePosition: source.position,
                        logicPosition: logicNode.position,
                        actionPosition: actionNode.position
                    }
                };

                await onSave(flowData);
            }
            alert("Automations deployed successfully!");
        } catch (err) {
            alert("Failed to save some flows");
        } finally {
            setSaving(false);
        }
    };

    const clearCanvas = () => {
        if (confirm("Clear all nodes?")) {
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
                    colorMode="system"
                    fitView
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
