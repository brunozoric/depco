import type React from "react";
import { Badge, Card, Group, Select, Table, Text } from "@mantine/core";
import type { TrendsGateway } from "../../../../features/trends/abstractions/TrendsGateway.js";
import type { TrendsPresenter } from "../abstractions/TrendsPresenter.js";

interface DependencyChangesTableProps {
    items: TrendsGateway.DependencyChangeItem[];
    total: number;
    availableProjects: TrendsPresenter.ProjectOption[];
    projectFilter: string | null;
    onProjectFilterChange: (projectId: string | null) => void;
}

const CHANGE_TYPE_COLORS: Record<TrendsGateway.DependencyChangeItem["changeType"], string> = {
    added: "green",
    removed: "red",
    "version-changed": "yellow"
};

function formatDetectedAt(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

export function DependencyChangesTable({
    items,
    total,
    availableProjects,
    projectFilter,
    onProjectFilterChange
}: DependencyChangesTableProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Dependency Changes ({total})</Text>
                <Select
                    placeholder="Project"
                    clearable
                    searchable
                    value={projectFilter}
                    onChange={onProjectFilterChange}
                    data={availableProjects.map(project => ({
                        value: project.id,
                        label: project.name
                    }))}
                />
            </Group>

            {items.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    No dependency changes recorded yet
                </Text>
            ) : (
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Package</Table.Th>
                            <Table.Th>Project</Table.Th>
                            <Table.Th>Change</Table.Th>
                            <Table.Th>Previous Version</Table.Th>
                            <Table.Th>New Version</Table.Th>
                            <Table.Th>Detected At</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {items.map(item => (
                            <Table.Tr key={item.id}>
                                <Table.Td>{item.packageName}</Table.Td>
                                <Table.Td>
                                    <Text size="sm" c="dimmed">
                                        {item.projectName}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Badge color={CHANGE_TYPE_COLORS[item.changeType]}>
                                        {item.changeType}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>{item.previousVersion ?? "—"}</Table.Td>
                                <Table.Td>{item.newVersion ?? "—"}</Table.Td>
                                <Table.Td>{formatDetectedAt(item.detectedAt)}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
        </Card>
    );
}
