import type React from "react";
import { Badge, Button, Checkbox, Select, Table } from "@mantine/core";
import { UPGRADE_BADGE_COLORS } from "#ui/infrastructure/Shared/upgrades/upgradeBadgeColors.js";

interface ISelectOption {
    value: string;
    label: string;
}

export interface SelectPackagesRow {
    name: string;
    currentVersion: string;
    latestInRange: string;
    latestVersion: string;
    type: string;
    upgradeType: "patch" | "minor" | "major";
    selected: boolean;
    targetVersion: string;
}

interface SelectPackagesTableProps {
    rows: SelectPackagesRow[];
    onToggle: (name: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onSetTargetVersion: (name: string, version: string) => void;
    onViewChangelog: (name: string, currentVersion: string, latestVersion: string) => void;
}

interface SelectPackagesRowProps {
    row: SelectPackagesRow;
    onToggle: (name: string) => void;
    onSetTargetVersion: (name: string, version: string) => void;
    onViewChangelog: (name: string, currentVersion: string, latestVersion: string) => void;
}

function buildVersionOptions(row: SelectPackagesRow): ISelectOption[] {
    const options = new Map<string, string>();
    options.set(row.latestInRange, `In-range (${row.latestInRange})`);
    options.set(row.latestVersion, `Latest (${row.latestVersion})`);
    return Array.from(options, ([value, label]) => ({ value, label }));
}

function PackageRow({
    row,
    onToggle,
    onSetTargetVersion,
    onViewChangelog
}: SelectPackagesRowProps): React.ReactNode {
    return (
        <Table.Tr>
            <Table.Td>
                <Checkbox checked={row.selected} onChange={() => onToggle(row.name)} />
            </Table.Td>
            <Table.Td>{row.name}</Table.Td>
            <Table.Td>{row.currentVersion}</Table.Td>
            <Table.Td>{row.latestVersion}</Table.Td>
            <Table.Td>{row.type}</Table.Td>
            <Table.Td>
                <Badge color={UPGRADE_BADGE_COLORS[row.upgradeType] ?? "gray"}>
                    {row.upgradeType}
                </Badge>
            </Table.Td>
            <Table.Td>
                <Select
                    data={buildVersionOptions(row)}
                    value={row.targetVersion}
                    allowDeselect={false}
                    onChange={value => {
                        if (value) {
                            onSetTargetVersion(row.name, value);
                        }
                    }}
                />
            </Table.Td>
            <Table.Td>
                <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => onViewChangelog(row.name, row.currentVersion, row.latestVersion)}
                >
                    Changelog
                </Button>
            </Table.Td>
        </Table.Tr>
    );
}

export function SelectPackagesTable({
    rows,
    onToggle,
    onSelectAll,
    onDeselectAll,
    onSetTargetVersion,
    onViewChangelog
}: SelectPackagesTableProps): React.ReactNode {
    const allSelected = rows.length > 0 && rows.every(row => row.selected);
    const someSelected = rows.some(row => row.selected);

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
                    <Table.Th>Latest</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Upgrade</Table.Th>
                    <Table.Th>Target Version</Table.Th>
                    <Table.Th>Changelog</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {rows.map(row => (
                    <PackageRow
                        key={row.name}
                        row={row}
                        onToggle={onToggle}
                        onSetTargetVersion={onSetTargetVersion}
                        onViewChangelog={onViewChangelog}
                    />
                ))}
            </Table.Tbody>
        </Table>
    );
}
