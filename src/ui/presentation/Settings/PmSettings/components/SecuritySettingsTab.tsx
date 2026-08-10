import type React from "react";
import { useState } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Group,
    Menu,
    Stack,
    Switch,
    Table,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface SecuritySettingsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

interface IStartEditInput {
    id: string;
    currentValue: string;
}

interface IStartAddInput {
    fieldName: string;
    defaultValue: string;
}

export const SecuritySettingsTab = observer(function SecuritySettingsTab({
    presenter
}: SecuritySettingsTabProps): React.ReactNode {
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");
    const [addValue, setAddValue] = useState("");
    const isPmFileManaged = vm.fileManagedPms.includes(vm.selectedPackageManager);

    function handleStartEdit({ id, currentValue }: IStartEditInput): void {
        setEditValue(currentValue);
        presenter.startEdit(id);
    }

    function handleStartAdd({ fieldName, defaultValue }: IStartAddInput): void {
        setAddValue(defaultValue);
        presenter.startAdd(fieldName);
    }

    return (
        <Stack gap="md">
            {isPmFileManaged && (
                <Alert color="blue" title="Read-only">
                    PM settings for {vm.selectedPackageManager} are managed by{" "}
                    <Text component="code" ff="monospace">
                        .dependency-upgrader.json
                    </Text>
                    . Edit the file to change these values.
                </Alert>
            )}
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Field Name</Table.Th>
                        <Table.Th>Config File</Table.Th>
                        <Table.Th>Expected Value</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Enabled</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.settings.map(setting => (
                        <Table.Tr
                            key={setting.id}
                            style={setting.enabled ? undefined : { opacity: 0.5 }}
                            {...(setting.isOrphaned ? { bg: "orange.0" } : {})}
                        >
                            <Table.Td>
                                <Group gap="xs">
                                    <Text size="sm">{setting.description}</Text>
                                    {setting.isOrphaned && (
                                        <Tooltip label="This field is no longer in the registry. You can edit or delete it.">
                                            <Badge size="sm" color="orange">
                                                Orphaned
                                            </Badge>
                                        </Tooltip>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm" c="dimmed">
                                    {setting.configFile}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                {setting.inputType === "exists" ? (
                                    <Text size="sm" c="dimmed" fs="italic">
                                        Field must exist
                                    </Text>
                                ) : setting.inputType === "boolean" ? (
                                    <Switch
                                        size="sm"
                                        checked={setting.expectedValue === "true"}
                                        disabled={setting.isFileManaged}
                                        onChange={event => {
                                            presenter.startEdit(setting.id);
                                            presenter.confirmEdit(
                                                event.currentTarget.checked ? "true" : "false"
                                            );
                                        }}
                                    />
                                ) : vm.editingId === setting.id ? (
                                    <Stack gap={2}>
                                        <Group gap="xs">
                                            <TextInput
                                                size="xs"
                                                value={editValue}
                                                onChange={e => setEditValue(e.currentTarget.value)}
                                            />
                                            <Button
                                                size="xs"
                                                onClick={() => presenter.confirmEdit(editValue)}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="subtle"
                                                onClick={() => presenter.cancelEdit()}
                                            >
                                                Cancel
                                            </Button>
                                        </Group>
                                        {setting.helperText && (
                                            <Text size="xs" c="dimmed">
                                                {setting.helperText}
                                            </Text>
                                        )}
                                    </Stack>
                                ) : (
                                    <Text size="sm">{setting.expectedValue}</Text>
                                )}
                            </Table.Td>
                            <Table.Td>
                                <Group justify="flex-end">
                                    <Switch
                                        size="sm"
                                        checked={setting.enabled}
                                        disabled={setting.isFileManaged}
                                        onChange={() => presenter.toggle(setting.id)}
                                        styles={{ track: { cursor: "pointer" } }}
                                    />
                                </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                                {vm.editingId !== setting.id &&
                                    setting.inputType !== "exists" &&
                                    setting.inputType !== "boolean" &&
                                    !setting.isFileManaged && (
                                        <ActionIcon
                                            variant="subtle"
                                            size="sm"
                                            onClick={() =>
                                                handleStartEdit({
                                                    id: setting.id,
                                                    currentValue: setting.expectedValue
                                                })
                                            }
                                        >
                                            &#9998;
                                        </ActionIcon>
                                    )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                    {vm.addingField && (
                        <Table.Tr>
                            <Table.Td>
                                <Text size="sm">{vm.addingField}</Text>
                            </Table.Td>
                            <Table.Td />
                            <Table.Td>
                                {(() => {
                                    const addingDef = vm.availableFields.find(
                                        f => f.fieldName === vm.addingField
                                    );
                                    if (addingDef?.inputType === "boolean") {
                                        return (
                                            <Group gap="xs">
                                                <Switch
                                                    size="sm"
                                                    checked={addValue === "true"}
                                                    onChange={event =>
                                                        presenter.confirmAdd(
                                                            event.currentTarget.checked
                                                                ? "true"
                                                                : "false"
                                                        )
                                                    }
                                                />
                                                <Button
                                                    size="xs"
                                                    variant="subtle"
                                                    onClick={() => presenter.cancelAdd()}
                                                >
                                                    Cancel
                                                </Button>
                                            </Group>
                                        );
                                    }
                                    return (
                                        <Stack gap={2}>
                                            <Group gap="xs">
                                                <TextInput
                                                    size="xs"
                                                    value={addValue}
                                                    onChange={e =>
                                                        setAddValue(e.currentTarget.value)
                                                    }
                                                />
                                                <Button
                                                    size="xs"
                                                    onClick={() => presenter.confirmAdd(addValue)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="subtle"
                                                    onClick={() => presenter.cancelAdd()}
                                                >
                                                    Cancel
                                                </Button>
                                            </Group>
                                            {addingDef?.helperText && (
                                                <Text size="xs" c="dimmed">
                                                    {addingDef.helperText}
                                                </Text>
                                            )}
                                        </Stack>
                                    );
                                })()}
                            </Table.Td>
                            <Table.Td />
                            <Table.Td />
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Group gap="sm">
                {vm.availableFields.length > 0 && !vm.addingField && (
                    <Menu shadow="md" width={300} disabled={isPmFileManaged}>
                        <Menu.Target>
                            <Button variant="light" disabled={isPmFileManaged}>
                                Add Setting
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {vm.availableFields.map(field => (
                                <Menu.Item
                                    key={field.fieldName}
                                    onClick={() => {
                                        if (field.inputType === "exists") {
                                            presenter.startAdd(field.fieldName);
                                            presenter.confirmAdd("exists");
                                        } else {
                                            handleStartAdd({
                                                fieldName: field.fieldName,
                                                defaultValue: field.defaultExpectedValue
                                            });
                                        }
                                    }}
                                >
                                    {field.description}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                )}
                {vm.canReset && (
                    <Button
                        variant="light"
                        color="orange"
                        disabled={isPmFileManaged}
                        onClick={() => presenter.resetToDefaults()}
                    >
                        Reset to Defaults
                    </Button>
                )}
            </Group>
        </Stack>
    );
});
