import type React from "react";
import { Card, Text, Badge, Stack, Group } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { DashboardGateway } from "#ui/features/Dashboard/abstractions/DashboardGateway.js";
import { formatTimeAgo } from "#ui/infrastructure/Shared/formatting/dateFormatters.js";

interface RecentActivityWidgetProps {
    jobs: DashboardGateway.ActivityJob[];
}

const STATUS_COLOR: Record<string, string> = {
    completed: "green",
    failed: "red",
    cancelled: "yellow",
    pending: "gray",
    running: "blue",
    interrupted: "orange"
};

export function RecentActivityWidget({ jobs }: RecentActivityWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Recent Activity</Text>
                <Text
                    size="xs"
                    c="blue"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/jobs")}
                >
                    View all
                </Text>
            </Group>

            {jobs.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No recent jobs.
                </Text>
            ) : (
                <Stack gap="xs">
                    {jobs.slice(0, 10).map(job => (
                        <Group key={job.id} justify="space-between" wrap="nowrap">
                            <Group gap="xs" wrap="nowrap">
                                <Badge size="xs" variant="light">
                                    {job.type}
                                </Badge>
                                <Text size="xs" truncate>
                                    {job.referenceId}
                                </Text>
                            </Group>
                            <Group gap="xs" wrap="nowrap">
                                <Badge size="xs" color={STATUS_COLOR[job.status] ?? "gray"}>
                                    {job.status}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                    {formatTimeAgo(job.startedAt)}
                                </Text>
                            </Group>
                        </Group>
                    ))}
                </Stack>
            )}
        </Card>
    );
}
