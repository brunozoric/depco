import type React from "react";
import { Anchor, Badge, Table } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";
import { UPGRADE_BADGE_COLORS } from "#ui/infrastructure/Shared/upgrades/upgradeBadgeColors.js";

interface PackageDetailProjectsTableProps {
    projects: PackagesGateway.PackageDetailProject[];
}

export function PackageDetailProjectsTable({
    projects
}: PackageDetailProjectsTableProps): React.ReactNode {
    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Project</Table.Th>
                    <Table.Th>Current</Table.Th>
                    <Table.Th>Latest</Table.Th>
                    <Table.Th>Upgrade</Table.Th>
                    <Table.Th>Dependency Kind</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {projects.map(project => (
                    <Table.Tr key={project.projectId}>
                        <Table.Td>
                            <Anchor
                                component="button"
                                size="sm"
                                onClick={() => navigate(`/projects/${project.projectId}`)}
                            >
                                {project.projectName}
                            </Anchor>
                        </Table.Td>
                        <Table.Td>{project.currentVersion}</Table.Td>
                        <Table.Td>{project.latestVersion}</Table.Td>
                        <Table.Td>
                            {project.upgradeType !== "none" && (
                                <Badge
                                    size="sm"
                                    color={UPGRADE_BADGE_COLORS[project.upgradeType] ?? "gray"}
                                >
                                    {project.upgradeType}
                                </Badge>
                            )}
                        </Table.Td>
                        <Table.Td>{project.dependencyKind}</Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}
