import type React from "react";
import { Card, Text, Stack, Group, Progress } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { DashboardGateway } from "#ui/features/Dashboard/abstractions/DashboardGateway.js";

interface SecurityOverviewWidgetProps {
    projects: DashboardGateway.SecurityProject[];
}

export function SecurityOverviewWidget({ projects }: SecurityOverviewWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                Security Overview
            </Text>

            {projects.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No security checks yet.
                </Text>
            ) : (
                <Stack gap="xs">
                    {projects.map(project => {
                        const ratio =
                            project.totalChecks > 0
                                ? Math.round((project.passingChecks / project.totalChecks) * 100)
                                : 100;
                        const color = ratio === 100 ? "green" : ratio >= 50 ? "yellow" : "red";

                        return (
                            <Group
                                key={project.projectId}
                                justify="space-between"
                                wrap="nowrap"
                                style={{ cursor: "pointer" }}
                                onClick={() => navigate(`/projects/${project.projectId}`)}
                            >
                                <Text size="sm" truncate style={{ flex: 1 }}>
                                    {project.projectName}
                                </Text>
                                <Group gap="xs" wrap="nowrap" style={{ minWidth: 140 }}>
                                    <Progress
                                        value={ratio}
                                        color={color}
                                        size="sm"
                                        style={{ flex: 1 }}
                                    />
                                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                        {project.passingChecks}/{project.totalChecks}
                                    </Text>
                                </Group>
                            </Group>
                        );
                    })}
                </Stack>
            )}
        </Card>
    );
}
