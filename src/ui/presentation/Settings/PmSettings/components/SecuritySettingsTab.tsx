import type React from "react";
import { useState } from "react";
import { Alert, Button, Group, Menu, Stack, Table, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SettingsTableRow } from "./SettingsTableRow.js";
import { AddSettingInlineRow } from "./AddSettingInlineRow.js";

interface SecuritySettingsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

export const SecuritySettingsTab = observer(function SecuritySettingsTab({
    presenter
}: SecuritySettingsTabProps): React.ReactNode {
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");
    const [addValue, setAddValue] = useState("");
    const isPmFileManaged = vm.fileManagedPms.includes(vm.selectedPackageManager);

    function handleStartEdit(input: { id: string; currentValue: string }): void {
        setEditValue(input.currentValue);
        presenter.startEdit(input.id);
    }

    function handleStartAdd(input: { fieldName: string; defaultValue: string }): void {
        setAddValue(input.defaultValue);
        presenter.startAdd(input.fieldName);
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
                        <SettingsTableRow
                            key={setting.id}
                            setting={setting}
                            presenter={presenter}
                            editingId={vm.editingId}
                            editValue={editValue}
                            onEditValueChange={setEditValue}
                            onStartEdit={handleStartEdit}
                        />
                    ))}
                    <AddSettingInlineRow
                        presenter={presenter}
                        addValue={addValue}
                        onAddValueChange={setAddValue}
                    />
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
