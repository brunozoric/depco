import type React from "react";
import { Badge, Button, Checkbox, Group, Table } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { SEVERITY_COLORS } from "#ui/infrastructure/Shared/vulnerabilities/severityColors.js";

interface DependencyTableProps {
    dependencies: ProjectDetailPresenter.DependencyViewModel[];
    onToggle: (name: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onViewChangelog: (name: string, currentVersion: string, latestVersion: string) => void;
}

interface DependencyRowProps {
    dependency: ProjectDetailPresenter.DependencyViewModel;
    onToggle: (name: string) => void;
    onViewChangelog: (name: string, currentVersion: string, latestVersion: string) => void;
}

const UPGRADE_BADGE_COLOR: Record<
    ProjectDetailPresenter.DependencyViewModel["upgradeType"],
    string
> = {
    patch: "green",
    minor: "yellow",
    major: "red",
    none: "gray"
};

interface DependencyKindBadgeConfig {
    label: string;
    color: string;
}

const DEPENDENCY_KIND_BADGES: Record<string, DependencyKindBadgeConfig> = {
    dependency: { label: "Direct", color: "blue" },
    devDependency: { label: "Dev", color: "grape" },
    peerDependency: { label: "Peer", color: "cyan" },
    optionalDependency: { label: "Optional", color: "orange" },
    transitive: { label: "Transitive", color: "gray" }
};

const DEFAULT_DEPENDENCY_KIND_BADGE: DependencyKindBadgeConfig = {
    label: "Unknown",
    color: "gray"
};

function getDependencyKindBadge(dependencyKind: string): DependencyKindBadgeConfig {
    return DEPENDENCY_KIND_BADGES[dependencyKind] ?? DEFAULT_DEPENDENCY_KIND_BADGE;
}

const DependencyRow = observer(function DependencyRow({
    dependency,
    onToggle,
    onViewChangelog
}: DependencyRowProps): React.ReactNode {
    const isUnresolved = !dependency.registryResolved;
    const isUpToDate = dependency.upgradeType === "none";
    const canUpgrade = !isUpToDate && !isUnresolved;
    const kindBadge = getDependencyKindBadge(dependency.dependencyKind);

    return (
        <Table.Tr>
            <Table.Td>
                <Checkbox
                    checked={dependency.selected}
                    disabled={isUpToDate || isUnresolved}
                    onChange={() => onToggle(dependency.name)}
                />
            </Table.Td>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    {dependency.name}
                    {dependency.vulnerabilityCount > 0 && dependency.vulnerabilityMaxSeverity && (
                        <Badge
                            size="xs"
                            color={SEVERITY_COLORS[dependency.vulnerabilityMaxSeverity]}
                        >
                            {dependency.vulnerabilityCount}
                        </Badge>
                    )}
                </Group>
            </Table.Td>
            <Table.Td>{dependency.currentVersion}</Table.Td>
            <Table.Td>{dependency.latestInRange}</Table.Td>
            <Table.Td>{isUnresolved ? "Resolving..." : dependency.latestVersion}</Table.Td>
            <Table.Td>{dependency.type}</Table.Td>
            <Table.Td>
                <Badge color={kindBadge.color}>{kindBadge.label}</Badge>
            </Table.Td>
            <Table.Td>
                <Badge color={UPGRADE_BADGE_COLOR[dependency.upgradeType]}>
                    {dependency.upgradeType}
                </Badge>
            </Table.Td>
            <Table.Td>
                {canUpgrade && (
                    <Button
                        size="xs"
                        variant="subtle"
                        onClick={() =>
                            onViewChangelog(
                                dependency.name,
                                dependency.currentVersion,
                                dependency.latestVersion
                            )
                        }
                    >
                        Changelog
                    </Button>
                )}
            </Table.Td>
        </Table.Tr>
    );
});

export const DependencyTable = observer(function DependencyTable({
    dependencies,
    onToggle,
    onSelectAll,
    onDeselectAll,
    onViewChangelog
}: DependencyTableProps): React.ReactNode {
    const allSelected =
        dependencies.length > 0 && dependencies.every(dependency => dependency.selected);
    const someSelected = dependencies.some(dependency => dependency.selected);

    const handleHeaderToggle = (): void => {
        if (allSelected) {
            onDeselectAll();
        } else {
            onSelectAll();
        }
    };

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>
                        <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onChange={handleHeaderToggle}
                        />
                    </Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Current</Table.Th>
                    <Table.Th>In-Range</Table.Th>
                    <Table.Th>Latest</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Kind</Table.Th>
                    <Table.Th>Upgrade</Table.Th>
                    <Table.Th>Changelog</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {dependencies.map(dependency => (
                    <DependencyRow
                        key={dependency.name}
                        dependency={dependency}
                        onToggle={onToggle}
                        onViewChangelog={onViewChangelog}
                    />
                ))}
            </Table.Tbody>
        </Table>
    );
});
