import type React from "react";
import { Button, Code, Group, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface RefreshTransientStepProps {
    presenter: UpgradeWizardPresenter.Interface;
}

export const RefreshTransientStep = observer(function RefreshTransientStep({
    presenter
}: RefreshTransientStepProps): React.ReactNode {
    const { vm } = presenter;

    const handleRefresh = async (): Promise<void> => {
        await presenter.executeStep("refresh-transient", { refresh: true });
    };

    const handleSkip = async (): Promise<void> => {
        await presenter.skipStep("refresh-transient");
    };

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Refreshing transient dependencies re-resolves the lockfile so indirect dependencies
                pick up any newly available versions within their allowed ranges. This can take a
                while on large projects.
            </Text>

            {vm.stepLogs.length > 0 && (
                <Code block mah={300} style={{ overflow: "auto" }}>
                    {vm.stepLogs.join("\n")}
                </Code>
            )}

            <Group justify="flex-end">
                <Button variant="default" onClick={handleSkip} disabled={vm.loading}>
                    Skip
                </Button>
                <Button onClick={handleRefresh} loading={vm.loading}>
                    Refresh
                </Button>
            </Group>
        </Stack>
    );
});
