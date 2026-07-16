import type React from "react";
import { useState } from "react";
import { Button, Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { resolveTemplate } from "#shared/templates/resolveTemplate.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface BranchStepProps {
    presenter: UpgradeWizardPresenter.Interface;
}

export const BranchStep = observer(function BranchStep({
    presenter
}: BranchStepProps): React.ReactNode {
    const { vm } = presenter;

    const [createBranch, setCreateBranch] = useState(true);
    const [branchName, setBranchName] = useState(() => resolveTemplate(vm.branchTemplate, {}));

    const handleContinue = async (): Promise<void> => {
        if (createBranch) {
            await presenter.executeStep("branch", { create: true, branchName });
        } else {
            await presenter.executeStep("branch", { create: false });
        }
    };

    const handleSkip = async (): Promise<void> => {
        await presenter.skipStep("branch");
    };

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Optionally create a new branch before upgrading dependencies.
            </Text>

            <Checkbox
                label="Create a new branch"
                checked={createBranch}
                onChange={event => setCreateBranch(event.currentTarget.checked)}
            />

            {createBranch && (
                <TextInput
                    label="Branch name"
                    value={branchName}
                    onChange={event => setBranchName(event.currentTarget.value)}
                />
            )}

            <Group justify="flex-end">
                <Button variant="default" onClick={handleSkip} disabled={vm.loading}>
                    Skip
                </Button>
                <Button
                    onClick={handleContinue}
                    loading={vm.loading}
                    disabled={createBranch && branchName.length === 0}
                >
                    Continue
                </Button>
            </Group>
        </Stack>
    );
});
