import type React from "react";

export type DependencyNodeKind =
    | "dependency"
    | "devDependency"
    | "peerDependency"
    | "optionalDependency"
    | "transitive";

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

interface DependencyKindDotProps {
    kind: DependencyNodeKind;
}

export function DependencyKindDot({ kind }: DependencyKindDotProps): React.ReactNode {
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
