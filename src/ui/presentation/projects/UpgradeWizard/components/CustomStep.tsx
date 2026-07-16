import type React from "react";
import { useEffect } from "react";
import { Badge, Button, Code, Group, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface CustomStepProps {
    presenter: UpgradeWizardPresenter.Interface;
    stepType: string;
}

export const CustomStep = observer(function CustomStep({
    presenter,
    stepType
}: CustomStepProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        if (vm.activeStep?.type === stepType && vm.activeStep.status === "active") {
            void presenter.executeStep(stepType, {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [presenter, vm.activeStep?.type, vm.activeStep?.status]);

    const step = vm.session?.steps.find(s => s.type === stepType);
    const name = (step?.input["name"] as string) ?? stepType;
    const command = (step?.input["command"] as string) ?? "";
    const isRequired = !stepType.startsWith("pre:") && !stepType.startsWith("post:");
    const stepRequired =
        step?.input["required"] !== undefined ? Boolean(step.input["required"]) : isRequired;

    return (
        <Stack gap="md">
            <Group gap="sm">
                <Text size="sm" fw={500}>
                    {name}
                </Text>
                <Badge size="sm" variant="light" color="gray">
                    custom
                </Badge>
            </Group>

            {command && <Code>{command}</Code>}

            {vm.loading && <Loader size="sm" />}

            {step?.status === "skipped" && Boolean(step.result["error"]) && (
                <Text size="sm" c="orange">
                    Skipped: {String(step.result["error"])}
                </Text>
            )}

            {vm.stepLogs.length > 0 && (
                <Code block mah={300} style={{ overflow: "auto" }}>
                    {vm.stepLogs.join("\n")}
                </Code>
            )}

            {!stepRequired &&
                vm.activeStep?.type === stepType &&
                vm.activeStep.status === "active" &&
                !vm.loading && (
                    <Button variant="subtle" size="sm" onClick={() => presenter.skipStep(stepType)}>
                        Skip
                    </Button>
                )}
        </Stack>
    );
});
