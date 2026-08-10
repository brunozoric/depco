import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";

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
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );

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
                    <SecuritySettingsTab presenter={presenter} />
                </Tabs.Panel>

                <Tabs.Panel value="install" pt="md">
                    <InstallFlagsTab presenter={presenter} />
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
