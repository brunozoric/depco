import type React from "react";
import { Group, SegmentedControl, Select, Switch, TextInput } from "@mantine/core";
import type { IProjectFilterOption } from "../abstractions/PackagesPresenter.js";

const UPGRADE_TYPE_OPTIONS = [
    { label: "All", value: "all" },
    { label: "None", value: "none" },
    { label: "Patch", value: "patch" },
    { label: "Minor", value: "minor" },
    { label: "Major", value: "major" }
];

const DEPENDENCY_KIND_OPTIONS = [
    { label: "All", value: "all" },
    { label: "Direct", value: "dependency" },
    { label: "Dev", value: "devDependency" },
    { label: "Peer", value: "peerDependency" },
    { label: "Optional", value: "optionalDependency" },
    { label: "Transitive", value: "transitive" }
];

interface PackageFilterToolbarProps {
    search: string;
    upgradeType: string | null;
    dependencyKind: string | null;
    projectId: string | null;
    hasChangelog: boolean;
    projectOptions: IProjectFilterOption[];
    onSearchChange: (value: string) => void;
    onUpgradeTypeChange: (value: string | null) => void;
    onDependencyKindChange: (value: string | null) => void;
    onProjectIdChange: (value: string | null) => void;
    onHasChangelogChange: (checked: boolean) => void;
}

export function PackageFilterToolbar({
    search,
    upgradeType,
    dependencyKind,
    projectId,
    hasChangelog,
    projectOptions,
    onSearchChange,
    onUpgradeTypeChange,
    onDependencyKindChange,
    onProjectIdChange,
    onHasChangelogChange
}: PackageFilterToolbarProps): React.ReactNode {
    return (
        <Group gap="md">
            <TextInput
                placeholder="Search packages..."
                value={search}
                onChange={event => onSearchChange(event.currentTarget.value)}
                style={{ flex: 1 }}
            />
            <SegmentedControl
                value={upgradeType ?? "all"}
                onChange={value => onUpgradeTypeChange(value === "all" ? null : value)}
                data={UPGRADE_TYPE_OPTIONS}
            />
            <Select
                placeholder="Dependency kind"
                data={DEPENDENCY_KIND_OPTIONS}
                value={dependencyKind ?? "all"}
                onChange={value => onDependencyKindChange(value === "all" ? null : value)}
                style={{ minWidth: 160 }}
            />
            <Select
                placeholder="All projects"
                data={projectOptions}
                value={projectId}
                onChange={value => onProjectIdChange(value)}
                clearable
                style={{ minWidth: 200 }}
            />
            <Switch
                label="Has changelog"
                checked={hasChangelog}
                onChange={event => onHasChangelogChange(event.currentTarget.checked)}
            />
        </Group>
    );
}
