import type React from "react";
import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

const UPGRADE_STRATEGY_OPTIONS = [
    { value: "", label: "None (default)" },
    { value: "caret", label: "Caret (^)" },
    { value: "tilde", label: "Tilde (~)" },
    { value: "exact", label: "Exact" },
    { value: "latest", label: "Latest" }
];

interface GeneralSettingsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

export const GeneralSettingsTab = observer(function GeneralSettingsTab({
    presenter
}: GeneralSettingsTabProps): React.ReactNode {
    const { vm } = presenter;
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    return (
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
                    disabled={registryUrlInput === (vm.generalSettings.registryUrl ?? "")}
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
                    disabled={upgradeStrategyInput === (vm.generalSettings.upgradeStrategy ?? "")}
                >
                    Save
                </Button>
            </Group>
        </Stack>
    );
});
