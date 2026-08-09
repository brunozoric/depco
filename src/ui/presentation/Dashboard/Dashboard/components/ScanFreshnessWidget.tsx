import type React from "react";
import { Card, Text, Stack, Group } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "#ui/features/Dashboard/abstractions/DashboardGateway.js";

interface ScanFreshnessWidgetProps {
    projects: DashboardGateway.StalenessProject[];
}

function formatStaleness(lastScannedAt: number | null): string {
    if (!lastScannedAt) {
        return "Never scanned";
    }
    const days = Math.floor((Date.now() - lastScannedAt) / (1000 * 60 * 60 * 24));
    if (days === 0) {
        return "Scanned today";
    }
    if (days === 1) {
        return "1 day ago";
    }
    return `${days} days ago`;
}

function isStale(lastScannedAt: number | null): boolean {
    if (!lastScannedAt) {
        return true;
    }
    const days = (Date.now() - lastScannedAt) / (1000 * 60 * 60 * 24);
    return days > 7;
}

export function ScanFreshnessWidget({ projects }: ScanFreshnessWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                Scan Freshness
            </Text>

            {projects.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No projects yet.
                </Text>
            ) : (
                <Stack gap="xs">
                    {projects.map(project => (
                        <Group
                            key={project.projectId}
                            justify="space-between"
                            wrap="nowrap"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/Projects/${project.projectId}`)}
                        >
                            <Text size="sm" truncate>
                                {project.projectName}
                            </Text>
                            <Group gap={4} wrap="nowrap">
                                {isStale(project.lastScannedAt) && (
                                    <Text size="xs" c="orange">
                                        ⚠
                                    </Text>
                                )}
                                <Text size="xs" c="dimmed">
                                    {formatStaleness(project.lastScannedAt)}
                                </Text>
                            </Group>
                        </Group>
                    ))}
                </Stack>
            )}
        </Card>
    );
}
