import type React from "react";
import { useEffect } from "react";
import { Code, List, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface UpgradeStepProps {
    presenter: UpgradeWizardPresenter.Interface;
}

interface ISelectedPackage {
    name: string;
    targetVersion: string;
}

export const UpgradeStep = observer(function UpgradeStep({
    presenter
}: UpgradeStepProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        if (vm.activeStep?.type === "upgrade" && vm.activeStep.status === "active") {
            void presenter.executeStep("upgrade", {});
        }
        // Only run when the active step transitions to the upgrade step.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [presenter, vm.activeStep?.type, vm.activeStep?.status]);

    const selectPackagesStep = vm.session?.steps.find(step => step.type === "select-packages");
    const packages = (selectPackagesStep?.input["packages"] ?? []) as ISelectedPackage[];

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Upgrading the following packages:
            </Text>

            <List size="sm">
                {packages.map(pkg => (
                    <List.Item key={pkg.name}>
                        {pkg.name} &rarr; {pkg.targetVersion}
                    </List.Item>
                ))}
            </List>

            {vm.loading && <Loader size="sm" />}

            {vm.stepLogs.length > 0 && (
                <Code block mah={300} style={{ overflow: "auto" }}>
                    {vm.stepLogs.join("\n")}
                </Code>
            )}
        </Stack>
    );
});
