import type React from "react";
import { Anchor, Badge, Button, Group, Pagination, Stack, Table, Text } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";

const PAGE_SIZE = 10;

const UPGRADE_BADGE_COLOR: Record<string, string> = {
    patch: "green",
    minor: "yellow",
    major: "red",
    none: "gray"
};

interface IUpgradeTarget {
    projectId: string;
    projectName: string;
    packageName: string;
    latestVersion: string;
}

interface IExpandedDependenciesProps {
    packageName: string;
    projects: PackagesGateway.PackageProject[];
    page: number;
    onPageChange: (page: number) => void;
    onUpgrade: (target: IUpgradeTarget) => void;
}

export function ExpandedDependencies({
    packageName,
    projects,
    page,
    onPageChange,
    onUpgrade
}: IExpandedDependenciesProps): React.ReactNode {
    const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const visibleProjects = projects.slice(start, start + PAGE_SIZE);

    return (
        <Table.Tr>
            <Table.Td colSpan={5} p="sm">
                <Stack gap="xs">
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Project</Table.Th>
                                <Table.Th>Current</Table.Th>
                                <Table.Th>Latest</Table.Th>
                                <Table.Th>Upgrade</Table.Th>
                                <Table.Th></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {visibleProjects.map(project => (
                                <Table.Tr key={project.projectId}>
                                    <Table.Td>
                                        <Anchor
                                            component="button"
                                            size="sm"
                                            onClick={() =>
                                                navigate(`/Projects/${project.projectId}`)
                                            }
                                        >
                                            {project.projectName}
                                        </Anchor>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{project.currentVersion}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{project.latestVersion}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            size="xs"
                                            color={
                                                UPGRADE_BADGE_COLOR[project.upgradeType] ?? "gray"
                                            }
                                        >
                                            {project.upgradeType}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        {project.upgradeType !== "none" && (
                                            <Button
                                                size="xs"
                                                variant="light"
                                                onClick={() =>
                                                    onUpgrade({
                                                        projectId: project.projectId,
                                                        projectName: project.projectName,
                                                        packageName,
                                                        latestVersion: project.latestVersion
                                                    })
                                                }
                                            >
                                                Upgrade
                                            </Button>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                    {totalPages > 1 && (
                        <Group justify="center">
                            <Pagination
                                total={totalPages}
                                value={page}
                                onChange={onPageChange}
                                size="xs"
                            />
                        </Group>
                    )}
                </Stack>
            </Table.Td>
        </Table.Tr>
    );
}
