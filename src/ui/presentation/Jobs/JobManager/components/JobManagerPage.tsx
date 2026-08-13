import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Button,
    Group,
    Pagination,
    SegmentedControl,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import type { JobManagerPresenter } from "../abstractions/JobManagerPresenter.js";
import { JobsFilterBar } from "./JobsFilterBar.js";
import { JobsTable } from "./JobsTable.js";

interface JobManagerPageProps {
    presenter: JobManagerPresenter.Interface;
}

const STATUS_FILTER_OPTIONS = [
    { label: "All", value: "all" },
    { label: "Running", value: "running" },
    { label: "Pending", value: "pending" },
    { label: "Completed", value: "completed" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Interrupted", value: "interrupted" }
];

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

            <JobsFilterBar
                typeFilter={vm.typeFilter}
                referenceFilter={vm.referenceFilter}
                dateFrom={vm.dateFrom}
                dateTo={vm.dateTo}
                references={vm.references}
                onFilterChange={(key, value) => presenter.setFilter(key, value)}
                onClear={() => presenter.clearFilters()}
            />

            <JobsTable
                jobs={vm.jobs}
                expandedJobId={vm.expandedJobId}
                loading={vm.loading}
                onToggleDetails={jobId => presenter.toggleJobDetails(jobId)}
                onCancel={jobId => presenter.cancel(jobId)}
            />

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

interface DeleteJobsButtonProps {
    presenter: JobManagerPresenter.Interface;
    total: number;
}

function DeleteJobsButton({ presenter, total }: DeleteJobsButtonProps): React.ReactNode {
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
