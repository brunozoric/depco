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
    Select,
    Stack,
    Table,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/shared/router/router.js";
import { ConfirmDialog } from "#ui/shared/components/ConfirmDialog.js";
import type { LogBrowserPresenter } from "../abstractions/LogBrowserPresenter.js";

interface LogBrowserPageProps {
    presenter: LogBrowserPresenter.Interface;
}

const LEVEL_COLORS: Record<string, string> = {
    error: "red",
    warn: "orange",
    info: "blue"
};

const LEVEL_OPTIONS = [
    { label: "Error", value: "error" },
    { label: "Warning", value: "warn" },
    { label: "Info", value: "info" }
];

const SOURCE_OPTIONS = [
    { label: "Scan", value: "scan" },
    { label: "Upgrade", value: "upgrade" },
    { label: "Install", value: "install" },
    { label: "Step Resolver", value: "step-resolver" },
    { label: "Git", value: "git" },
    { label: "Clone", value: "clone" }
];

function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
}

// Converts an epoch-ms string (as stored by the presenter) into the local
// "YYYY-MM-DDTHH:mm" format expected by <input type="datetime-local">.
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

// Converts a datetime-local input value back into an epoch-ms string, or
// null when the input was cleared / invalid.
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

            <Group gap="sm">
                <Select
                    size="xs"
                    placeholder="Level"
                    data={LEVEL_OPTIONS}
                    value={vm.levelFilter}
                    onChange={value => presenter.setFilter("level", value)}
                    clearable
                    style={{ width: 130 }}
                />
                <Select
                    size="xs"
                    placeholder="Source"
                    data={SOURCE_OPTIONS}
                    value={vm.sourceFilter}
                    onChange={value => presenter.setFilter("source", value)}
                    clearable
                    style={{ width: 150 }}
                />
                <Select
                    size="xs"
                    placeholder="Project"
                    data={vm.projects}
                    value={vm.projectFilter}
                    onChange={value => presenter.setFilter("project", value)}
                    clearable
                    searchable
                    style={{ width: 180 }}
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
