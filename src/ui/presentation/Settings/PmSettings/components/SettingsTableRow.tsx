import type React from "react";
import {
    ActionIcon,
    Badge,
    Button,
    Group,
    Stack,
    Switch,
    Table,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface IStartEditInput {
    id: string;
    currentValue: string;
}

interface ISettingsTableRowProps {
    setting: PmSettingsPresenter.SettingViewModel;
    presenter: PmSettingsPresenter.Interface;
    editingId: string | null;
    editValue: string;
    onEditValueChange: (value: string) => void;
    onStartEdit: (input: IStartEditInput) => void;
}

export const SettingsTableRow = observer(function SettingsTableRow({
    setting,
    presenter,
    editingId,
    editValue,
    onEditValueChange,
    onStartEdit
}: ISettingsTableRowProps): React.ReactNode {
    return (
        <Table.Tr
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
                            presenter.confirmEdit(event.currentTarget.checked ? "true" : "false");
                        }}
                    />
                ) : editingId === setting.id ? (
                    <Stack gap={2}>
                        <Group gap="xs">
                            <TextInput
                                size="xs"
                                value={editValue}
                                onChange={e => onEditValueChange(e.currentTarget.value)}
                            />
                            <Button size="xs" onClick={() => presenter.confirmEdit(editValue)}>
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
                {editingId !== setting.id &&
                    setting.inputType !== "exists" &&
                    setting.inputType !== "boolean" &&
                    !setting.isFileManaged && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() =>
                                onStartEdit({
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
    );
});
