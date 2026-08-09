import type React from "react";
import { ActionIcon, Badge, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";

interface DiscoveredScriptsListProps {
    scripts: StepHooksPresenter.DiscoveredScriptViewModel[];
    configSource: "db" | "file";
    onAdd: (name: string, command: string) => void;
}

function truncate(value: string, max = 60): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function DiscoveredScriptsList({
    scripts,
    configSource,
    onAdd
}: DiscoveredScriptsListProps): React.ReactNode {
    if (scripts.length === 0) {
        return null;
    }

    const addDisabled = configSource === "file";

    return (
        <Stack gap="xs">
            <Group gap="xs">
                <Text size="sm" fw={600}>
                    Detected from package.json
                </Text>
                <Badge variant="light" color="orange" size="sm">
                    {scripts.length}
                </Badge>
            </Group>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Script</Table.Th>
                        <Table.Th>Command</Table.Th>
                        <Table.Th>Action</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {scripts.map(script => (
                        <Table.Tr key={script.name}>
                            <Table.Td>
                                <Text size="sm" fw={500}>
                                    {script.name}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm" c="dimmed" title={script.command}>
                                    {truncate(script.command)}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                {addDisabled ? (
                                    <Tooltip label="Hooks managed by config file — add scripts directly to .dependency-upgrader.json">
                                        <ActionIcon variant="subtle" size="sm" disabled>
                                            +
                                        </ActionIcon>
                                    </Tooltip>
                                ) : (
                                    <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        onClick={() => onAdd(script.name, script.command)}
                                    >
                                        +
                                    </ActionIcon>
                                )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}
