import type React from "react";
import { Button, Group, Stack, Switch, Table, Text, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface AddSettingInlineRowProps {
    presenter: PmSettingsPresenter.Interface;
    addValue: string;
    onAddValueChange: (value: string) => void;
}

export const AddSettingInlineRow = observer(function AddSettingInlineRow({
    presenter,
    addValue,
    onAddValueChange
}: AddSettingInlineRowProps): React.ReactNode {
    const { vm } = presenter;

    if (!vm.addingField) {
        return null;
    }

    const addingDefinition = vm.availableFields.find(f => f.fieldName === vm.addingField);

    return (
        <Table.Tr>
            <Table.Td>
                <Text size="sm">{vm.addingField}</Text>
            </Table.Td>
            <Table.Td />
            <Table.Td>
                {addingDefinition?.inputType === "boolean" ? (
                    <Group gap="xs">
                        <Switch
                            size="sm"
                            checked={addValue === "true"}
                            onChange={event =>
                                presenter.confirmAdd(event.currentTarget.checked ? "true" : "false")
                            }
                        />
                        <Button size="xs" variant="subtle" onClick={() => presenter.cancelAdd()}>
                            Cancel
                        </Button>
                    </Group>
                ) : (
                    <Stack gap={2}>
                        <Group gap="xs">
                            <TextInput
                                size="xs"
                                value={addValue}
                                onChange={e => onAddValueChange(e.currentTarget.value)}
                            />
                            <Button size="xs" onClick={() => presenter.confirmAdd(addValue)}>
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
                        {addingDefinition?.helperText && (
                            <Text size="xs" c="dimmed">
                                {addingDefinition.helperText}
                            </Text>
                        )}
                    </Stack>
                )}
            </Table.Td>
            <Table.Td />
            <Table.Td />
        </Table.Tr>
    );
});
