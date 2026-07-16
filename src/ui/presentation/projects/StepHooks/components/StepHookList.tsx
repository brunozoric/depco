import type React from "react";
import { useState } from "react";
import { ActionIcon, Badge, Group, Switch, Table, Text } from "@mantine/core";
import { ConfirmDialog } from "#ui/shared/components/ConfirmDialog.js";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";

const POSITION_ORDER = [
    "pre:select-packages",
    "post:select-packages",
    "pre:branch",
    "post:branch",
    "pre:upgrade",
    "post:upgrade",
    "pre:refresh-transient",
    "post:refresh-transient",
    "pre:commit",
    "post:commit"
];

const TYPE_COLORS: Record<string, string> = {
    command: "blue",
    script: "grape",
    "package-script": "teal"
};

const SOURCE_COLORS: Record<string, string> = {
    db: "green",
    file: "gray",
    "package-json": "orange"
};

function truncate(value: string, max = 60): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

interface StepHookListProps {
    hooks: StepHooksPresenter.HookViewModel[];
    onToggleEnabled: (hookId: string) => Promise<void>;
    onEdit: (hookId: string) => void;
    onDelete: (hookId: string) => Promise<void>;
}

export function StepHookList({
    hooks,
    onToggleEnabled,
    onEdit,
    onDelete
}: StepHookListProps): React.ReactNode {
    if (hooks.length === 0) {
        return (
            <Text c="dimmed" size="sm">
                No step hooks configured
            </Text>
        );
    }

    const sorted = [...hooks].sort((a, b) => {
        const positionDiff =
            POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);
        if (positionDiff !== 0) {
            return positionDiff;
        }
        return a.sortOrder - b.sortOrder;
    });

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Position</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Command</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Required</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Enabled</Table.Th>
                    <Table.Th>Actions</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {sorted.map(hook => (
                    <StepHookRow
                        key={hook.id}
                        hook={hook}
                        onToggleEnabled={onToggleEnabled}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
            </Table.Tbody>
        </Table>
    );
}

interface StepHookRowProps {
    hook: StepHooksPresenter.HookViewModel;
    onToggleEnabled: (hookId: string) => Promise<void>;
    onEdit: (hookId: string) => void;
    onDelete: (hookId: string) => Promise<void>;
}

function StepHookRow({
    hook,
    onToggleEnabled,
    onEdit,
    onDelete
}: StepHookRowProps): React.ReactNode {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const editable = hook.source === "db";

    return (
        <Table.Tr>
            <Table.Td>
                <Badge variant="light">{hook.position}</Badge>
            </Table.Td>
            <Table.Td>
                <Text size="sm">{hook.name}</Text>
            </Table.Td>
            <Table.Td>
                <Text size="sm" c="dimmed" title={hook.command}>
                    {truncate(hook.command)}
                </Text>
            </Table.Td>
            <Table.Td>
                <Badge color={TYPE_COLORS[hook.type] ?? "gray"} variant="light">
                    {hook.type}
                </Badge>
            </Table.Td>
            <Table.Td>
                <Badge color={hook.required ? "red" : "gray"} variant="light">
                    {hook.required ? "Required" : "Optional"}
                </Badge>
            </Table.Td>
            <Table.Td>
                <Badge color={SOURCE_COLORS[hook.source] ?? "gray"} variant="outline">
                    {hook.source}
                </Badge>
            </Table.Td>
            <Table.Td>
                <Switch
                    checked={hook.enabled}
                    onChange={() => void onToggleEnabled(hook.id)}
                    disabled={!editable}
                />
            </Table.Td>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => onEdit(hook.id)}
                        disabled={!editable}
                    >
                        &#9998;
                    </ActionIcon>
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="red"
                        onClick={() => setConfirmOpen(true)}
                        disabled={!editable}
                    >
                        &#10005;
                    </ActionIcon>
                </Group>
                <ConfirmDialog
                    opened={confirmOpen}
                    title="Delete Step Hook"
                    message={`Delete "${hook.name}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    onConfirm={() => {
                        setConfirmOpen(false);
                        void onDelete(hook.id);
                    }}
                    onCancel={() => setConfirmOpen(false)}
                />
            </Table.Td>
        </Table.Tr>
    );
}
