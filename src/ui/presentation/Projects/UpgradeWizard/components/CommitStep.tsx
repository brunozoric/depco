import type React from "react";
import { useState } from "react";
import { Alert, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { resolveTemplate } from "#shared/templates/resolveTemplate.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface CommitStepProps {
    presenter: UpgradeWizardPresenter.Interface;
}

export const CommitStep = observer(function CommitStep({
    presenter
}: CommitStepProps): React.ReactNode {
    const { vm } = presenter;
    const step = vm.activeStep;

    const [message, setMessage] = useState(() => resolveTemplate(vm.commitTemplate, {}));

    const handleCommit = async (): Promise<void> => {
        await presenter.executeStep("commit", { message });
    };

    const handleSkip = async (): Promise<void> => {
        await presenter.skipStep("commit");
    };

    if (step?.status === "completed") {
        const commitHash = step.result["commitHash"];
        const filesChanged = step.result["filesChanged"];

        return (
            <Alert color="green" title="Changes committed">
                <Text size="sm">Commit: {String(commitHash)}</Text>
                <Text size="sm">Files changed: {String(filesChanged)}</Text>
            </Alert>
        );
    }

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Commit the upgraded dependencies with the message below.
            </Text>

            <TextInput
                label="Commit message"
                value={message}
                onChange={event => setMessage(event.currentTarget.value)}
            />

            <Group justify="flex-end">
                <Button variant="default" onClick={handleSkip} disabled={vm.loading}>
                    Skip
                </Button>
                <Button onClick={handleCommit} loading={vm.loading} disabled={message.length === 0}>
                    Commit
                </Button>
            </Group>
        </Stack>
    );
});
