import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    type Edge as FlowEdge,
    type Node as FlowNode,
    type NodeMouseHandler
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";

interface DependencyGraphViewProps {
    presenter: DependencyGraphPresenter.Interface;
}

type DependencyNodeKind =
    | "dependency"
    | "devDependency"
    | "peerDependency"
    | "optionalDependency"
    | "transitive";

interface DependencyNodeData extends Record<string, unknown> {
    label: React.ReactNode;
    packageName: string;
}

interface VisibleNodeInfo {
    id: string;
    packageName: string;
    version: string;
    depth: number;
    dependencyKind: DependencyNodeKind;
}

// Depth 0 renders in the darkest (primary) shade; deeper levels get
// progressively lighter shades. Clamped to the last entry beyond this.
const DEPTH_COLORS = ["#1c7ed6", "#4dabf7", "#a5d8ff", "#d0ebff", "#e7f5ff"];

// Subtle dependency-kind dots, layered on top of the depth-based background.
const DEPENDENCY_KIND_LABELS: Record<DependencyNodeKind, string> = {
    dependency: "Direct dependency",
    devDependency: "Dev dependency",
    peerDependency: "Peer dependency",
    optionalDependency: "Optional dependency",
    transitive: "Transitive dependency"
};

const DEPENDENCY_KIND_COLORS: Record<DependencyNodeKind, string> = {
    dependency: "#228be6",
    devDependency: "#be4bdb",
    peerDependency: "#15aabf",
    optionalDependency: "#f76707",
    transitive: "#868e96"
};

const BASE_VISIBLE_DEPTH = 1;
const HORIZONTAL_SPACING = 220;
const VERTICAL_SPACING = 150;

function buildNodeId(packageName: string, version: string): string {
    return `${packageName}@${version}`;
}

function depthColor(depth: number): string {
    const index = Math.min(depth, DEPTH_COLORS.length - 1);
    return DEPTH_COLORS[index] ?? DEPTH_COLORS[DEPTH_COLORS.length - 1]!;
}

function resolveDependencyKind(dependencyType: string, depth: number): DependencyNodeKind {
    if (depth > 0) {
        return "transitive";
    }
    if (dependencyType === "devDependency") {
        return "devDependency";
    }
    if (dependencyType === "peerDependency") {
        return "peerDependency";
    }
    if (dependencyType === "optionalDependency") {
        return "optionalDependency";
    }
    return "dependency";
}

interface DependencyKindDotProps {
    kind: DependencyNodeKind;
}

function DependencyKindDot({ kind }: DependencyKindDotProps): React.ReactNode {
    return (
        <span
            title={DEPENDENCY_KIND_LABELS[kind]}
            style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: DEPENDENCY_KIND_COLORS[kind],
                flexShrink: 0
            }}
        />
    );
}

interface BuiltGraphElements {
    nodes: FlowNode<DependencyNodeData>[];
    edges: FlowEdge[];
}

function buildGraphElements(
    graphEdges: DependencyGraphPresenter.Edge[],
    paths: DependencyGraphPresenter.Path[],
    searchQuery: string,
    selectedPackage: string | null,
    expandedNodeIds: ReadonlySet<string>,
    displayMode: DependencyGraphPresenter.SearchMode,
    filters: DependencyGraphPresenter.Filters
): BuiltGraphElements {
    let filteredEdges = graphEdges;

    if (filters.dependencyKind) {
        filteredEdges = filteredEdges.filter(edge => {
            const kind = resolveDependencyKind(edge.dependencyType, edge.depth);
            return kind === filters.dependencyKind;
        });
    }

    if (filters.maxDepth !== null) {
        filteredEdges = filteredEdges.filter(edge => edge.depth <= filters.maxDepth!);
    }

    const sortedEdges = [...filteredEdges].sort((a, b) => a.depth - b.depth);

    const nodeInfoById = new Map<string, VisibleNodeInfo>();
    for (const edge of sortedEdges) {
        const id = buildNodeId(edge.childPackage, edge.childVersion);
        if (!nodeInfoById.has(id)) {
            nodeInfoById.set(id, {
                id,
                packageName: edge.childPackage,
                version: edge.childVersion,
                depth: edge.depth,
                dependencyKind: resolveDependencyKind(edge.dependencyType, edge.depth)
            });
        }
    }

    const isSearching = searchQuery.trim() !== "";
    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    if (isSearching) {
        for (const path of paths) {
            let previousId: string | null = null;
            for (const node of path.chain) {
                const id = buildNodeId(node.packageName, node.version);
                highlightedNodeIds.add(id);
                if (previousId) {
                    highlightedEdgeIds.add(`${previousId}->${id}`);
                }
                previousId = id;
            }
        }
    }

    const visibleIds = new Set<string>(highlightedNodeIds);
    for (const edge of sortedEdges) {
        if (edge.parentPackage === null) {
            visibleIds.add(buildNodeId(edge.childPackage, edge.childVersion));
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const edge of sortedEdges) {
            if (edge.parentPackage === null) {
                continue;
            }
            const parentId = buildNodeId(edge.parentPackage, edge.parentVersion ?? "");
            const childId = buildNodeId(edge.childPackage, edge.childVersion);
            if (visibleIds.has(childId) || !visibleIds.has(parentId)) {
                continue;
            }
            if (edge.depth <= BASE_VISIBLE_DEPTH || expandedNodeIds.has(parentId)) {
                visibleIds.add(childId);
                changed = true;
            }
        }
    }

    const depthGroups = new Map<number, VisibleNodeInfo[]>();
    for (const id of visibleIds) {
        const info = nodeInfoById.get(id);
        if (!info) {
            continue;
        }
        const group = depthGroups.get(info.depth) ?? [];
        group.push(info);
        depthGroups.set(info.depth, group);
    }

    const isSearchActive = searchQuery.trim() !== "" && highlightedNodeIds.size > 0;

    const nodes: FlowNode<DependencyNodeData>[] = [];
    for (const [depth, infos] of depthGroups) {
        const sortedInfos = [...infos].sort((a, b) => a.packageName.localeCompare(b.packageName));
        let positionIndex = 0;
        for (const info of sortedInfos) {
            const isSelected = selectedPackage === info.packageName;
            const isHighlighted = highlightedNodeIds.has(info.id);

            if (isSearchActive && displayMode === "matchesOnly" && !isHighlighted && !isSelected) {
                continue;
            }

            const dimmed = isSearchActive && displayMode === "dim" && !isHighlighted && !isSelected;

            nodes.push({
                id: info.id,
                position: {
                    x: positionIndex * HORIZONTAL_SPACING,
                    y: depth * VERTICAL_SPACING
                },
                data: {
                    label: (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                            }}
                        >
                            <DependencyKindDot kind={info.dependencyKind} />
                            <span>
                                {info.packageName}@{info.version}
                            </span>
                        </span>
                    ),
                    packageName: info.packageName
                },
                style: {
                    background: depthColor(depth),
                    color: depth === 0 ? "#ffffff" : "#1a1b1e",
                    border: isSelected
                        ? "3px solid #f08c00"
                        : isHighlighted
                          ? "3px solid #fab005"
                          : "1px solid #ced4da",
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 12,
                    fontWeight: depth === 0 ? 700 : 500,
                    opacity: dimmed ? 0.3 : 1
                }
            });
            positionIndex++;
        }
    }

    const edges: FlowEdge[] = [];
    for (const edge of sortedEdges) {
        if (edge.parentPackage === null) {
            continue;
        }
        const parentId = buildNodeId(edge.parentPackage, edge.parentVersion ?? "");
        const childId = buildNodeId(edge.childPackage, edge.childVersion);
        if (!visibleIds.has(parentId) || !visibleIds.has(childId)) {
            continue;
        }
        const edgeId = `${parentId}->${childId}`;
        const isHighlighted = highlightedEdgeIds.has(edgeId);
        edges.push({
            id: edgeId,
            source: parentId,
            target: childId,
            animated: isHighlighted,
            style: {
                stroke: isHighlighted ? "#fab005" : "#ced4da",
                strokeWidth: isHighlighted ? 2.5 : 1.5
            }
        });
    }

    return { nodes, edges };
}

export const DependencyGraphView = observer(function DependencyGraphView({
    presenter
}: DependencyGraphViewProps): React.ReactNode {
    const { vm } = presenter;
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

    const handleNodeClick = useCallback<NodeMouseHandler<FlowNode<DependencyNodeData>>>(
        (_event, node) => {
            presenter.selectPackage(node.data.packageName);
            setExpandedNodeIds(current => {
                if (current.has(node.id)) {
                    return current;
                }
                const next = new Set(current);
                next.add(node.id);
                return next;
            });
        },
        [presenter]
    );

    const { nodes, edges } = useMemo(
        () =>
            buildGraphElements(
                vm.edges,
                vm.paths,
                vm.searchQuery,
                vm.selectedPackage,
                expandedNodeIds,
                vm.searchMode,
                vm.filters
            ),
        [
            vm.edges,
            vm.paths,
            vm.searchQuery,
            vm.selectedPackage,
            expandedNodeIds,
            vm.searchMode,
            vm.filters
        ]
    );

    return (
        <div
            style={{
                height: 600,
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 8
            }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodeClick={handleNodeClick}
                nodesDraggable={false}
                nodesConnectable={false}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>
        </div>
    );
});
