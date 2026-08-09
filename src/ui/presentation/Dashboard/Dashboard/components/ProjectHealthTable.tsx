import type React from "react";
import { Table, Badge, Text } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { DashboardGateway } from "#ui/features/Dashboard/abstractions/DashboardGateway.js";

interface ProjectHealthTableProps {
    projects: DashboardGateway.HealthProject[];
    onScoreClick: (projectId: string) => void;
}

function formatDelta(delta: number | null): React.ReactNode {
    if (delta === null) {
        return (
            <Text size="sm" c="dimmed">
                —
            </Text>
        );
    }
    const color = delta > 0 ? "green" : delta < 0 ? "red" : "dimmed";
    const prefix = delta > 0 ? "+" : "";
    return (
        <Text size="sm" c={color}>
            {prefix}
            {delta}
        </Text>
    );
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) {
        return "Never";
    }
    return new Date(timestamp).toLocaleDateString();
}

export function ProjectHealthTable({
    projects,
    onScoreClick
}: ProjectHealthTableProps): React.ReactNode {
    if (projects.length === 0) {
        return <Text c="dimmed">No health data yet. Scan a project to get started.</Text>;
    }

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Project</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>7d Delta</Table.Th>
                    <Table.Th>Major</Table.Th>
                    <Table.Th>Minor</Table.Th>
                    <Table.Th>Patch</Table.Th>
                    <Table.Th>Last Scanned</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {projects.map(project => (
                    <Table.Tr
                        key={project.projectId}
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/Projects/${project.projectId}`)}
                    >
                        <Table.Td>{project.projectName}</Table.Td>
                        <Table.Td>
                            <Badge
                                color={
                                    project.score > 80
                                        ? "green"
                                        : project.score > 50
                                          ? "yellow"
                                          : "red"
                                }
                                style={{ cursor: "pointer" }}
                                onClick={event => {
                                    event.stopPropagation();
                                    onScoreClick(project.projectId);
                                }}
                            >
                                {project.score}%
                            </Badge>
                        </Table.Td>
                        <Table.Td>{formatDelta(project.scoreDelta)}</Table.Td>
                        <Table.Td>
                            {project.majorOutdated > 0 ? (
                                <Badge color="red" size="sm">
                                    {project.majorOutdated}
                                </Badge>
                            ) : (
                                "0"
                            )}
                        </Table.Td>
                        <Table.Td>
                            {project.minorOutdated > 0 ? (
                                <Badge color="yellow" size="sm">
                                    {project.minorOutdated}
                                </Badge>
                            ) : (
                                "0"
                            )}
                        </Table.Td>
                        <Table.Td>
                            {project.patchOutdated > 0 ? (
                                <Badge color="green" size="sm">
                                    {project.patchOutdated}
                                </Badge>
                            ) : (
                                "0"
                            )}
                        </Table.Td>
                        <Table.Td>{formatDate(project.lastScannedAt)}</Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}
