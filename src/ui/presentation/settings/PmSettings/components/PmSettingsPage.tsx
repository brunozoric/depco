import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Center,
    Group,
    Loader,
    Menu,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Switch,
    Table,
    Tabs,
    Text,
    TextInput,
    Title,
    Tooltip
} from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

const UPGRADE_STRATEGY_OPTIONS = [
    { value: "", label: "None (default)" },
    { value: "caret", label: "Caret (^)" },
    { value: "tilde", label: "Tilde (~)" },
    { value: "exact", label: "Exact" },
    { value: "latest", label: "Latest" }
];

interface PmSettingsPageProps {
    presenter: PmSettingsPresenter.Interface;
}

export const PmSettingsPage = observer(function PmSettingsPage({
    presenter
}: PmSettingsPageProps): React.ReactNode {
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");
    const [addValue, setAddValue] = useState("");
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );
    const isPmFileManaged = vm.fileManagedPms.includes(vm.selectedPackageManager);

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    function handleStartEdit(id: string, currentValue: string): void {
        setEditValue(currentValue);
        presenter.startEdit(id);
    }

    function handleStartAdd(fieldName: string, defaultValue: string): void {
        setAddValue(defaultValue);
        presenter.startAdd(fieldName);
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
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>PM Settings</Title>
            </Group>

            <SegmentedControl
                value={vm.selectedPackageManager}
                onChange={value => presenter.selectPackageManager(value as PackageManagerId)}
                data={[
                    { label: "Yarn", value: "yarn" },
                    { label: "NPM", value: "npm" },
                    { label: "PNPM", value: "pnpm" },
                    { label: "Bun", value: "bun" }
                ]}
            />

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

            <Tabs
                value={vm.activeTab}
                onChange={value => presenter.setActiveTab(value as PmSettingsPresenter.TabId)}
            >
                <Tabs.List>
                    <Tabs.Tab value="security">Security</Tabs.Tab>
                    <Tabs.Tab value="install">Install</Tabs.Tab>
                    <Tabs.Tab value="general">General</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="security" pt="md">
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
                                                            event.currentTarget.checked
                                                                ? "true"
                                                                : "false"
                                                        );
                                                    }}
                                                />
                                            ) : vm.editingId === setting.id ? (
                                                <Stack gap={2}>
                                                    <Group gap="xs">
                                                        <TextInput
                                                            size="xs"
                                                            value={editValue}
                                                            onChange={e =>
                                                                setEditValue(e.currentTarget.value)
                                                            }
                                                        />
                                                        <Button
                                                            size="xs"
                                                            onClick={() =>
                                                                presenter.confirmEdit(editValue)
                                                            }
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
                                                            handleStartEdit(
                                                                setting.id,
                                                                setting.expectedValue
                                                            )
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
                                                                onClick={() =>
                                                                    presenter.cancelAdd()
                                                                }
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
                                                                    setAddValue(
                                                                        e.currentTarget.value
                                                                    )
                                                                }
                                                            />
                                                            <Button
                                                                size="xs"
                                                                onClick={() =>
                                                                    presenter.confirmAdd(addValue)
                                                                }
                                                            >
                                                                Save
                                                            </Button>
                                                            <Button
                                                                size="xs"
                                                                variant="subtle"
                                                                onClick={() =>
                                                                    presenter.cancelAdd()
                                                                }
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
                                                        handleStartAdd(
                                                            field.fieldName,
                                                            field.defaultExpectedValue
                                                        );
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
                </Tabs.Panel>

                <Tabs.Panel value="install" pt="md">
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Flag</Table.Th>
                                <Table.Th>Label</Table.Th>
                                <Table.Th>Description</Table.Th>
                                <Table.Th style={{ textAlign: "right" }}>Enabled</Table.Th>
                                <Table.Th style={{ textAlign: "right" }}>Default</Table.Th>
                                <Table.Th style={{ textAlign: "right" }}>Source</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {vm.installFlags.map(flag => (
                                <Table.Tr key={flag.flag}>
                                    <Table.Td>
                                        <Text size="sm" ff="monospace">
                                            {flag.flag}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{flag.label}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">
                                            {flag.description}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: "right" }}>
                                        <Switch
                                            checked={flag.enabled}
                                            onChange={() => presenter.toggleInstallFlag(flag.flag)}
                                            size="sm"
                                            aria-label={`Toggle ${flag.label}`}
                                        />
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: "right" }}>
                                        <Badge size="sm" variant="outline" color="gray">
                                            {flag.defaultEnabled ? "Default on" : "Default off"}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: "right" }}>
                                        {flag.isFileManaged && (
                                            <Badge size="sm" color="blue">
                                                File
                                            </Badge>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                            {vm.installFlags.length === 0 && (
                                <Table.Tr>
                                    <Table.Td colSpan={6}>
                                        <Text size="sm" c="dimmed" ta="center" py="md">
                                            No install flags available for{" "}
                                            {vm.selectedPackageManager}.
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                </Tabs.Panel>

                <Tabs.Panel value="general" pt="md">
                    <Stack gap="md">
                        <Group align="end">
                            <TextInput
                                label="Registry URL"
                                placeholder="https://registry.npmjs.org"
                                value={registryUrlInput}
                                onChange={e => setRegistryUrlInput(e.currentTarget.value)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                size="sm"
                                onClick={() => presenter.saveRegistryUrl(registryUrlInput)}
                                disabled={
                                    registryUrlInput === (vm.generalSettings.registryUrl ?? "")
                                }
                            >
                                Save
                            </Button>
                        </Group>
                        <Group align="end">
                            <Select
                                label="Upgrade Strategy"
                                data={UPGRADE_STRATEGY_OPTIONS}
                                value={upgradeStrategyInput}
                                onChange={value => setUpgradeStrategyInput(value ?? "")}
                                style={{ flex: 1 }}
                            />
                            <Button
                                size="sm"
                                onClick={() => presenter.saveUpgradeStrategy(upgradeStrategyInput)}
                                disabled={
                                    upgradeStrategyInput ===
                                    (vm.generalSettings.upgradeStrategy ?? "")
                                }
                            >
                                Save
                            </Button>
                        </Group>
                    </Stack>
                </Tabs.Panel>
            </Tabs>

            <Modal
                opened={vm.confirmDialog !== null}
                onClose={() => presenter.cancelSave()}
                title="Confirm changes"
                centered
            >
                <Stack gap="md">
                    <Text size="sm">{vm.confirmDialog?.description}</Text>
                    <Text size="xs" c="dimmed">
                        This will modify{" "}
                        <Text component="code" ff="monospace" size="xs">
                            .dependency-upgrader.json
                        </Text>
                    </Text>
                    <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 200 }}>
                        {JSON.stringify(vm.confirmDialog?.changes, null, 2)}
                    </pre>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => presenter.cancelSave()}>
                            Cancel
                        </Button>
                        <Button onClick={() => presenter.confirmSave()} loading={vm.saving}>
                            Confirm
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
});
