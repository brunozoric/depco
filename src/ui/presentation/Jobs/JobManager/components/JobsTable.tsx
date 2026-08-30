import type React from "react";
import { Fragment } from "react";
import {
    ActionIcon,
    Alert,
    Anchor,
    Badge,
    Center,
    Code,
    Group,
    Loader,
    Progress,
    Stack,
    Table,
    Text
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { JobManagerPresenter } from "../abstractions/JobManagerPresenter.js";
import { formatTimestamp } from "#ui/infrastructure/Shared/formatting/dateFormatters.js";

const STATUS_COLORS: Record<string, string> = {
    pending: "gray",
    running: "blue",
    completed: "green",
    failed: "red",
    cancelled: "orange",
    interrupted: "orange"
};

function formatDuration(startedAt: number | null, completedAt: number | null): string {
    if (!startedAt) {
        return "-";
    }
    const end = completedAt ?? Date.now();
    const seconds = Math.floor((end - startedAt) / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

interface JobsTableProps {
    jobs: JobManagerPresenter.JobViewModel[];
    expandedJobId: string | null;
    loading: boolean;
    onToggleDetails: (jobId: string) => void;
    onCancel: (jobId: string) => void;
}

export function JobsTable({
    jobs,
    expandedJobId,
    loading,
    onToggleDetails,
    onCancel
}: JobsTableProps): React.ReactNode {
    if (loading && jobs.length === 0) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    if (jobs.length === 0) {
        return <Text c="dimmed">No jobs found</Text>;
    }

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th>Actions</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {jobs.map(job => (
                    <Fragment key={job.id}>
                        <Table.Tr
                            onClick={() => onToggleDetails(job.id)}
                            style={{ cursor: "pointer" }}
                        >
                            <Table.Td>
                                {job.referenceType === "project" ? (
                                    <Anchor
                                        component="button"
                                        size="sm"
                                        onClick={event => {
                                            event.stopPropagation();
                                            navigate(`/projects/${job.referenceId}`);
                                        }}
                                    >
                                        {job.projectName}
                                    </Anchor>
                                ) : (
                                    <Text size="sm">{job.referenceId}</Text>
                                )}
                            </Table.Td>
                            <Table.Td>
                                <Group gap={4} wrap="nowrap">
                                    <Text size="sm">{job.type}</Text>
                                    {job.parentJobId && (
                                        <Text size="xs" c="dimmed">
                                            (chained)
                                        </Text>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td>
                                <Stack gap={4}>
                                    <Badge color={STATUS_COLORS[job.status] ?? "gray"}>
                                        {job.status}
                                    </Badge>
                                    {job.status === "running" && job.progress !== null && (
                                        <>
                                            <Progress value={job.progress} size="xs" w={120} />
                                            {job.progressLabel && (
                                                <Text size="xs" c="dimmed" lineClamp={1}>
                                                    {job.progressLabel}
                                                </Text>
                                            )}
                                        </>
                                    )}
                                </Stack>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">{formatTimestamp(job.startedAt)}</Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">
                                    {formatDuration(job.startedAt, job.completedAt)}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                {job.canCancel && (
                                    <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        color="red"
                                        onClick={event => {
                                            event.stopPropagation();
                                            void onCancel(job.id);
                                        }}
                                    >
                                        &#10005;
                                    </ActionIcon>
                                )}
                            </Table.Td>
                        </Table.Tr>
                        {expandedJobId === job.id && (job.logs || job.warning) && (
                            <Table.Tr>
                                <Table.Td colSpan={6}>
                                    <Stack gap="xs" p="sm">
                                        {job.parentJobId && (
                                            <Text size="xs" c="dimmed">
                                                Parent job: {job.parentJobId}
                                            </Text>
                                        )}
                                        {job.warning && (
                                            <Alert color="orange" title="Warning">
                                                {job.warning}
                                            </Alert>
                                        )}
                                        {job.logs && (
                                            <Code
                                                block
                                                style={{
                                                    maxHeight: 300,
                                                    overflow: "auto"
                                                }}
                                            >
                                                {job.logs}
                                            </Code>
                                        )}
                                    </Stack>
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Fragment>
                ))}
            </Table.Tbody>
        </Table>
    );
}
