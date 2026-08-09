import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Select,
    Stack,
    Table,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import { observer } from "mobx-react-lite";
import type { AppSettingsPresenter } from "../abstractions/AppSettingsPresenter.js";
import { ScanScheduleDefaultSection } from "./ScanScheduleDefaultSection.js";
import { PrSettingsSection } from "./PrSettingsSection.js";

interface AppSettingsPageProps {
    presenter: AppSettingsPresenter.Interface;
}

export const AppSettingsPage = observer(function AppSettingsPage({
    presenter
}: AppSettingsPageProps): React.ReactNode {
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    function handleStartEdit(key: string, currentValue: string): void {
        setEditValue(currentValue);
        presenter.startEdit(key);
    }

    if (vm.loading && vm.settings.length === 0) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    return (
        <Stack gap="md">
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/settings")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>App Settings</Title>
            </Group>

            <Text size="sm" c="dimmed">
                Configure application settings. Template tokens: {"${PROJECT}"}, {"${BRANCH}"},{" "}
                {"${YYYY}"}, {"${MM}"}, {"${DD}"}
            </Text>

            {vm.configSource === "file" && (
                <Alert color="yellow" title="File Config Active">
                    Some settings managed by .dependency-upgrader.json
                </Alert>
            )}

            {vm.configError && (
                <Alert color="yellow" title="Config file error">
                    <Text size="sm">{vm.configError.message}</Text>
                    <Text size="xs" c="dimmed" mt={4}>
                        Showing database values. Fix the config file to restore file-based settings.
                    </Text>
                </Alert>
            )}

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Setting</Table.Th>
                        <Table.Th>Value</Table.Th>
                        <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.settings.map(setting => (
                        <Table.Tr key={setting.key}>
                            <Table.Td>
                                <Stack gap={2}>
                                    <Text size="sm" fw={500}>
                                        {setting.label}
                                    </Text>
                                    {setting.description && (
                                        <Text size="xs" c="dimmed">
                                            {setting.description}
                                        </Text>
                                    )}
                                </Stack>
                            </Table.Td>
                            <Table.Td>
                                {vm.editingKey === setting.key ? (
                                    <Group gap="xs">
                                        {setting.options ? (
                                            <Select
                                                size="xs"
                                                data={setting.options}
                                                value={editValue}
                                                onChange={value => {
                                                    if (value) {
                                                        presenter.confirmEdit(value);
                                                    }
                                                }}
                                                style={{ width: 150 }}
                                            />
                                        ) : (
                                            <TextInput
                                                size="xs"
                                                style={{ flex: 1 }}
                                                value={editValue}
                                                onChange={e => setEditValue(e.currentTarget.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") {
                                                        presenter.confirmEdit(editValue);
                                                    }
                                                    if (e.key === "Escape") {
                                                        presenter.cancelEdit();
                                                    }
                                                }}
                                            />
                                        )}
                                        {!setting.options && (
                                            <Button
                                                size="xs"
                                                onClick={() => presenter.confirmEdit(editValue)}
                                            >
                                                Save
                                            </Button>
                                        )}
                                        <Button
                                            size="xs"
                                            variant="subtle"
                                            onClick={() => presenter.cancelEdit()}
                                        >
                                            Cancel
                                        </Button>
                                    </Group>
                                ) : (
                                    <Text size="sm" {...(setting.value ? {} : { c: "dimmed" })}>
                                        {setting.options
                                            ? (setting.options.find(o => o.value === setting.value)
                                                  ?.label ?? setting.value)
                                            : setting.value || "(not set)"}
                                    </Text>
                                )}
                            </Table.Td>
                            <Table.Td>
                                {vm.editingKey !== setting.key &&
                                    !vm.fileManaged.includes(setting.key) && (
                                        <ActionIcon
                                            variant="subtle"
                                            size="sm"
                                            onClick={() =>
                                                handleStartEdit(setting.key, setting.value)
                                            }
                                        >
                                            &#9998;
                                        </ActionIcon>
                                    )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>

            <ScanScheduleDefaultSection />

            <PrSettingsSection />
        </Stack>
    );
});
