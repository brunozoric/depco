import type React from "react";
import { Fragment, useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Anchor,
    Badge,
    Button,
    Center,
    Code,
    Group,
    Loader,
    Pagination,
    Progress,
    SegmentedControl,
    Select,
    Stack,
    Table,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import type { JobManagerPresenter } from "../abstractions/JobManagerPresenter.js";

interface JobManagerPageProps {
    presenter: JobManagerPresenter.Interface;
}

const STATUS_COLORS: Record<string, string> = {
    pending: "gray",
    running: "blue",
    completed: "green",
    failed: "red",
    cancelled: "orange",
    interrupted: "orange"
};

const STATUS_FILTER_OPTIONS = [
    { label: "All", value: "all" },
    { label: "Running", value: "running" },
    { label: "Pending", value: "pending" },
    { label: "Completed", value: "completed" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Interrupted", value: "interrupted" }
];

const TYPE_OPTIONS = [
    { label: "Scan", value: "scan" },
    { label: "Package Scan", value: "package-scan" },
    { label: "Dependency", value: "dependency" },
    { label: "Transient", value: "transient" },
    { label: "Transitive Resolve", value: "transitive-resolve" },
    { label: "Vulnerability Scan", value: "vulnerability-scan" },
    { label: "License Scan", value: "license-scan" },
    { label: "Graph Refresh", value: "graph-refresh" },
    { label: "Install", value: "install" },
    { label: "Clone", value: "clone" },
    { label: "Package Manager", value: "packageManager" },
    { label: "Changelog", value: "changelog" },
    { label: "Auto-Fix PR", value: "auto-fix-pr" }
];

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

function formatTime(timestamp: number | null): string {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
}

function epochMsToDatetimeLocal(value: string | null): string {
    if (!value) {
        return "";
    }
    const ms = Number(value);
    if (Number.isNaN(ms)) {
        return "";
    }
    const date = new Date(ms);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function datetimeLocalToEpochMs(value: string): string | null {
    if (!value) {
        return null;
    }
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) {
        return null;
    }
    return String(ms);
}

export const JobManagerPage = observer(function JobManagerPage({
    presenter
}: JobManagerPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        void presenter.load();
    }, [presenter]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    const hasRunningJobs = vm.jobs.some(job => job.status === "running");
    const [, setTick] = useState(0);

    useEffect(() => {
        if (!hasRunningJobs) {
            return;
        }
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [hasRunningJobs]);

    const totalPages = Math.ceil(vm.total / vm.pageSize);

    return (
        <Stack gap="md">
            <Group gap="sm" justify="space-between">
                <Group gap="sm">
                    <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                        &larr;
                    </ActionIcon>
                    <Title order={2}>Jobs</Title>
                    {vm.total > 0 && (
                        <Text size="sm" c="dimmed">
                            ({vm.total})
                        </Text>
                    )}
                </Group>
                <ActionIcon variant="subtle" size="lg" onClick={() => void presenter.load()}>
                    &#8635;
                </ActionIcon>
            </Group>

            <SegmentedControl
                value={vm.statusFilter ?? "all"}
                onChange={value => void presenter.setStatusFilter(value === "all" ? null : value)}
                data={STATUS_FILTER_OPTIONS}
            />

            <Group gap="sm">
                <Select
                    size="xs"
                    placeholder="Type"
                    data={TYPE_OPTIONS}
                    value={vm.typeFilter}
                    onChange={value => presenter.setFilter("type", value)}
                    clearable
                    style={{ width: 160 }}
                />
                <Select
                    size="xs"
                    placeholder="Reference"
                    data={vm.references}
                    value={vm.referenceFilter}
                    onChange={value => presenter.setFilter("reference", value)}
                    clearable
                    searchable
                    style={{ width: 200 }}
                />
                <TextInput
                    type="datetime-local"
                    size="xs"
                    placeholder="From"
                    value={epochMsToDatetimeLocal(vm.dateFrom)}
                    onChange={e =>
                        presenter.setFilter(
                            "dateFrom",
                            datetimeLocalToEpochMs(e.currentTarget.value)
                        )
                    }
                    style={{ width: 200 }}
                />
                <TextInput
                    type="datetime-local"
                    size="xs"
                    placeholder="To"
                    value={epochMsToDatetimeLocal(vm.dateTo)}
                    onChange={e =>
                        presenter.setFilter("dateTo", datetimeLocalToEpochMs(e.currentTarget.value))
                    }
                    style={{ width: 200 }}
                />
                <Button size="xs" variant="subtle" onClick={() => presenter.clearFilters()}>
                    Clear
                </Button>
            </Group>

            {vm.loading && vm.jobs.length === 0 ? (
                <Center py="xl">
                    <Loader />
                </Center>
            ) : vm.jobs.length === 0 ? (
                <Text c="dimmed">No jobs found</Text>
            ) : (
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
                        {vm.jobs.map(job => (
                            <Fragment key={job.id}>
                                <Table.Tr
                                    onClick={() => presenter.toggleJobDetails(job.id)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <Table.Td>
                                        {job.referenceType === "project" ? (
                                            <Anchor
                                                component="button"
                                                size="sm"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    navigate(`/Projects/${job.referenceId}`);
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
                                                    <Progress
                                                        value={job.progress}
                                                        size="xs"
                                                        w={120}
                                                    />
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
                                        <Text size="sm">{formatTime(job.startedAt)}</Text>
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
                                                    void presenter.cancel(job.id);
                                                }}
                                            >
                                                &#10005;
                                            </ActionIcon>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                                {vm.expandedJobId === job.id && (job.logs || job.warning) && (
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
            )}

            <Group gap="sm" justify="space-between">
                {totalPages > 1 && (
                    <Pagination
                        size="sm"
                        total={totalPages}
                        value={vm.page + 1}
                        onChange={p => presenter.setPage(p - 1)}
                    />
                )}
                <DeleteJobsButton presenter={presenter} total={vm.total} />
            </Group>
        </Stack>
    );
});

function DeleteJobsButton({
    presenter,
    total
}: {
    presenter: JobManagerPresenter.Interface;
    total: number;
}): React.ReactNode {
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <>
            <Button size="xs" color="red" variant="light" onClick={() => setConfirmOpen(true)}>
                Delete {total > 0 ? `(${total})` : "all"}
            </Button>
            <ConfirmDialog
                opened={confirmOpen}
                title="Delete Jobs"
                message={`Delete ${total} ${total === 1 ? "job" : "jobs"} matching the current filters? This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={() => {
                    setConfirmOpen(false);
                    void presenter.deleteFiltered();
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </>
    );
}
