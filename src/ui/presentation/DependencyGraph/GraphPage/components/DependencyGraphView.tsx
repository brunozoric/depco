import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    type Node as FlowNode,
    type NodeMouseHandler
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";
import { buildGraphElements, type DependencyNodeData } from "./dependencyGraphViewUtils.js";

interface DependencyGraphViewProps {
    presenter: DependencyGraphPresenter.Interface;
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
