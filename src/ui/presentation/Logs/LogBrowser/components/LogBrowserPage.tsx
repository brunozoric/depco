import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Center,
    Code,
    Group,
    Loader,
    Pagination,
    Stack,
    Table,
    Text,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import type { LogBrowserPresenter } from "../abstractions/LogBrowserPresenter.js";
import { LogFilterBar } from "./LogFilterBar.js";

interface LogBrowserPageProps {
    presenter: LogBrowserPresenter.Interface;
}

const LEVEL_COLORS: Record<string, string> = {
    error: "red",
    warn: "orange",
    info: "blue"
};

function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
}

export const LogBrowserPage = observer(function LogBrowserPage({
    presenter
}: LogBrowserPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    if (vm.loading && vm.logs.length === 0) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    const totalPages = Math.ceil(vm.total / vm.pageSize);

    return (
        <Stack gap="md">
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>Logs</Title>
            </Group>

            <LogFilterBar
                levelFilter={vm.levelFilter}
                sourceFilter={vm.sourceFilter}
                projectFilter={vm.projectFilter}
                projects={vm.projects}
                dateFrom={vm.dateFrom}
                dateTo={vm.dateTo}
                onFilterChange={(field, value) => presenter.setFilter(field, value)}
                onClearFilters={() => presenter.clearFilters()}
            />

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            {vm.logs.length === 0 ? (
                <Text c="dimmed">No log entries found</Text>
            ) : (
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Time</Table.Th>
                            <Table.Th>Level</Table.Th>
                            <Table.Th>Source</Table.Th>
                            <Table.Th>Project</Table.Th>
                            <Table.Th>Message</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {vm.logs.map(log => (
                            <>
                                <Table.Tr
                                    key={log.id}
                                    onClick={() => presenter.toggleDetails(log.id)}
                                    style={{ cursor: log.details ? "pointer" : undefined }}
                                >
                                    <Table.Td>
                                        <Text size="xs">{formatTimestamp(log.createdAt)}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge size="sm" color={LEVEL_COLORS[log.level] ?? "gray"}>
                                            {log.level}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{log.source}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        {log.projectName ? (
                                            <Text size="sm">{log.projectName}</Text>
                                        ) : (
                                            <Text size="sm" c="dimmed">
                                                -
                                            </Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" lineClamp={1}>
                                            {log.message}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                                {vm.expandedLogId === log.id && log.details && (
                                    <Table.Tr key={`${log.id}-details`}>
                                        <Table.Td colSpan={5}>
                                            <Code
                                                block
                                                style={{ maxHeight: 300, overflow: "auto" }}
                                            >
                                                {log.details}
                                            </Code>
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </>
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
                <DeleteLogsButton presenter={presenter} total={vm.total} />
            </Group>
        </Stack>
    );
});

function DeleteLogsButton({
    presenter,
    total
}: {
    presenter: LogBrowserPresenter.Interface;
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
                title="Delete Logs"
                message={`Delete ${total} log ${total === 1 ? "entry" : "entries"} matching the current filters? This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={() => {
                    setConfirmOpen(false);
                    presenter.deleteFiltered();
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </>
    );
}
