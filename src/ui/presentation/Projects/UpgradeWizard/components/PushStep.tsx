import type React from "react";
import { useEffect } from "react";
import { Alert, Button, Code, Group, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface PushStepProps {
    presenter: UpgradeWizardPresenter.Interface;
}

export const PushStep = observer(function PushStep({ presenter }: PushStepProps): React.ReactNode {
    const { vm } = presenter;
    const step = vm.activeStep;

    useEffect(() => {
        if (step?.type === "push" && step.status === "active") {
            void presenter.executeStep("push", {});
        }
        // Only run when the active step transitions to the push step.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [presenter, step?.type, step?.status]);

    const branchStep = vm.session?.steps.find(s => s.type === "branch");
    const branchName = branchStep?.result["currentBranch"] ?? "current branch";

    if (step?.status === "completed") {
        return (
            <Alert color="green" title="Pushed">
                <Text size="sm">
                    Pushed {String(step.result["branch"])} to {String(step.result["remote"])}
                </Text>
            </Alert>
        );
    }

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Pushing branch {String(branchName)} to origin...
            </Text>

            {vm.loading && <Loader size="sm" />}

            {vm.stepLogs.length > 0 && (
                <Code block mah={300} style={{ overflow: "auto" }}>
                    {vm.stepLogs.join("\n")}
                </Code>
            )}

            <Group justify="flex-end">
                <Button
                    variant="default"
                    onClick={() => presenter.skipStep("push")}
                    disabled={vm.loading}
                >
                    Skip
                </Button>
            </Group>
        </Stack>
    );
});
