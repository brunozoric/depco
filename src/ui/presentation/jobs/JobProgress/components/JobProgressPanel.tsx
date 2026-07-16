import type React from "react";
import { Badge, Card, Group, Progress, Stack, Text, Title, Tooltip } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { JobProgressPresenter } from "../abstractions/JobProgressPresenter.js";
import { JobLogViewer } from "./JobLogViewer.js";

interface JobProgressPanelProps {
    presenter: JobProgressPresenter.Interface;
}

const STATUS_BADGE_COLOR: Record<JobProgressPresenter.ActiveJobViewModel["status"], string> = {
    pending: "gray",
    running: "blue",
    completed: "green",
    failed: "red",
    cancelled: "orange",
    interrupted: "orange"
};

export const JobProgressPanel = observer(function JobProgressPanel({
    presenter
}: JobProgressPanelProps): React.ReactNode {
    const { vm } = presenter;

    if (!vm.activeJob) {
        return (
            <Card withBorder padding="md">
                <Text c="dimmed">No active job</Text>
            </Card>
        );
    }

    const { activeJob } = vm;

    return (
        <Card withBorder padding="md">
            <Stack gap="sm">
                <Group justify="space-between">
                    <Title order={4}>{activeJob.type}</Title>
                    <Badge color={STATUS_BADGE_COLOR[activeJob.status]}>{activeJob.status}</Badge>
                </Group>
                {activeJob.progress !== null && activeJob.status === "running" && (
                    <Stack gap={4}>
                        <Progress value={activeJob.progress} size="lg" animated />
                        {activeJob.progressLabel && (
                            <Text size="xs" c="dimmed">
                                {activeJob.progressLabel}
                            </Text>
                        )}
                    </Stack>
                )}
                <JobLogViewer logs={activeJob.logs} />
                {vm.history.length > 0 && (
                    <Stack gap="xs">
                        <Text fw={500}>Job History</Text>
                        {vm.history.map(job => (
                            <Group key={job.id} justify="space-between">
                                <Text size="sm">{job.type}</Text>
                                <Group gap="xs">
                                    <Badge size="sm" color={STATUS_BADGE_COLOR[job.status]}>
                                        {job.status}
                                    </Badge>
                                    {job.warning && (
                                        <Tooltip label={job.warning}>
                                            <Badge size="sm" color="orange">
                                                Warning
                                            </Badge>
                                        </Tooltip>
                                    )}
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Card>
    );
});
