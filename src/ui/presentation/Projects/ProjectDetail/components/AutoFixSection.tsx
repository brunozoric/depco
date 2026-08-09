import type React from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Accordion,
    Anchor,
    Badge,
    Button,
    Checkbox,
    Group,
    Select,
    Stack,
    Switch,
    Table,
    Text,
    TextInput
} from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface AutoFixSectionProps {
    presenter: ProjectDetailPresenter.Interface;
}

interface AutoFixSettingsFormState {
    enabled: boolean;
    upgradeTypes: string[];
    groupingStrategy: string;
    branchPrefix: string;
}

interface AutoFixVersionRangeLabel {
    fromLabel: string;
    toLabel: string;
}

const UPGRADE_TYPE_OPTIONS = [
    { value: "patch", label: "Patch" },
    { value: "minor", label: "Minor" },
    { value: "major", label: "Major" }
];

const GROUPING_STRATEGY_OPTIONS = [
    { value: "per-package", label: "Per package" },
    { value: "per-project", label: "Per project" },
    { value: "per-upgrade-type", label: "Per upgrade type" }
];

const AUTO_FIX_STATUS_COLORS: Record<string, string> = {
    pending: "blue",
    created: "green",
    merged: "teal",
    closed: "gray",
    failed: "red"
};

function settingsToFormState(
    settings: ProjectDetailPresenter.AutoFixSettingsViewModel
): AutoFixSettingsFormState {
    return {
        enabled: settings.enabled,
        upgradeTypes: settings.upgradeTypes,
        groupingStrategy: settings.groupingStrategy,
        branchPrefix: settings.branchPrefix
    };
}

function buildVersionRangeLabel(
    pullRequest: ProjectDetailPresenter.AutoFixPullRequestViewModel
): AutoFixVersionRangeLabel {
    if (pullRequest.packageNames.length === 1) {
        const packageName = pullRequest.packageNames[0]!;
        return {
            fromLabel: pullRequest.fromVersions[packageName] ?? "—",
            toLabel: pullRequest.toVersions[packageName] ?? "—"
        };
    }
    return { fromLabel: "multiple", toLabel: "multiple" };
}

export const AutoFixSection = observer(function AutoFixSection({
    presenter
}: AutoFixSectionProps): React.ReactNode {
    const { vm } = presenter;
    const [formState, setFormState] = useState<AutoFixSettingsFormState | null>(null);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        if (vm.autoFixSettings && !formState) {
            setFormState(settingsToFormState(vm.autoFixSettings));
        }
    }, [vm.autoFixSettings, formState]);

    async function handleSaveSettings(): Promise<void> {
        if (!formState) {
            return;
        }
        setSavingSettings(true);
        try {
            await presenter.updateAutoFixSettings({
                enabled: formState.enabled,
                upgradeTypes: formState.upgradeTypes,
                groupingStrategy: formState.groupingStrategy,
                branchPrefix: formState.branchPrefix
            });
        } finally {
            setSavingSettings(false);
        }
    }

    return (
        <Accordion>
            <Accordion.Item value="auto-fix">
                <Accordion.Control>Auto-Fix PRs</Accordion.Control>
                <Accordion.Panel>
                    <Stack gap="md">
                        {formState && (
                            <Stack gap="sm">
                                <Switch
                                    label="Enable auto-fix after scan"
                                    checked={formState.enabled}
                                    onChange={event =>
                                        setFormState(current =>
                                            current
                                                ? {
                                                      ...current,
                                                      enabled: event.currentTarget.checked
                                                  }
                                                : current
                                        )
                                    }
                                />
                                <Checkbox.Group
                                    label="Upgrade types"
                                    value={formState.upgradeTypes}
                                    onChange={value =>
                                        setFormState(current =>
                                            current ? { ...current, upgradeTypes: value } : current
                                        )
                                    }
                                >
                                    <Group gap="md" mt="xs">
                                        {UPGRADE_TYPE_OPTIONS.map(option => (
                                            <Checkbox
                                                key={option.value}
                                                value={option.value}
                                                label={option.label}
                                            />
                                        ))}
                                    </Group>
                                </Checkbox.Group>
                                <Select
                                    label="Grouping strategy"
                                    data={GROUPING_STRATEGY_OPTIONS}
                                    value={formState.groupingStrategy}
                                    onChange={value =>
                                        setFormState(current =>
                                            current
                                                ? {
                                                      ...current,
                                                      groupingStrategy:
                                                          value ?? current.groupingStrategy
                                                  }
                                                : current
                                        )
                                    }
                                />
                                <TextInput
                                    label="Branch prefix"
                                    value={formState.branchPrefix}
                                    onChange={event =>
                                        setFormState(current =>
                                            current
                                                ? {
                                                      ...current,
                                                      branchPrefix: event.currentTarget.value
                                                  }
                                                : current
                                        )
                                    }
                                />
                                <Group>
                                    <Button
                                        variant="light"
                                        loading={savingSettings}
                                        onClick={() => void handleSaveSettings()}
                                    >
                                        Save Settings
                                    </Button>
                                    <Button
                                        onClick={() => void presenter.generateAutoFixPrs()}
                                        loading={vm.autoFixRunning}
                                        disabled={vm.autoFixRunning || !vm.autoFixSettings}
                                    >
                                        Generate PRs
                                    </Button>
                                </Group>
                            </Stack>
                        )}

                        <Table striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Package(s)</Table.Th>
                                    <Table.Th>From → To</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>PR Link</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {vm.autoFixPullRequests.map(pullRequest => {
                                    const { fromLabel, toLabel } =
                                        buildVersionRangeLabel(pullRequest);
                                    return (
                                        <Table.Tr key={pullRequest.id}>
                                            <Table.Td>
                                                {pullRequest.packageNames.join(", ")}
                                            </Table.Td>
                                            <Table.Td>
                                                {fromLabel} → {toLabel}
                                            </Table.Td>
                                            <Table.Td>{pullRequest.upgradeType}</Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    color={
                                                        AUTO_FIX_STATUS_COLORS[
                                                            pullRequest.status
                                                        ] ?? "gray"
                                                    }
                                                >
                                                    {pullRequest.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                {pullRequest.prUrl ? (
                                                    <Anchor
                                                        href={pullRequest.prUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        View PR
                                                    </Anchor>
                                                ) : (
                                                    "—"
                                                )}
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>

                        {vm.autoFixPullRequests.length === 0 && (
                            <Text size="sm" c="dimmed">
                                No auto-fix pull requests yet.
                            </Text>
                        )}
                    </Stack>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
});
