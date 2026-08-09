import type React from "react";
import { useEffect, useMemo } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Stack,
    Stepper,
    Text,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";
import { SelectPackagesStep } from "./SelectPackagesStep.js";
import { BranchStep } from "./BranchStep.js";
import { UpgradeStep } from "./UpgradeStep.js";
import { RefreshTransientStep } from "./RefreshTransientStep.js";
import { CommitStep } from "./CommitStep.js";
import { PushStep } from "./PushStep.js";
import { PrStep } from "./PrStep.js";
import { CustomStep } from "./CustomStep.js";

interface UpgradeWizardPageProps {
    presenter: UpgradeWizardPresenter.Interface;
    projectId: string;
}

const BUILT_IN_LABELS: Record<string, string> = {
    "select-packages": "Select Packages",
    branch: "Branch",
    upgrade: "Upgrade",
    "refresh-transient": "Refresh Transient",
    commit: "Commit",
    push: "Push",
    "create-pr": "Create PR"
};

interface StepGroup {
    builtInType: string;
    label: string;
    steps: string[];
}

function groupSteps(stepOrder: string[]): StepGroup[] {
    const groupMap = new Map<string, StepGroup>();

    for (const stepType of stepOrder) {
        if (BUILT_IN_LABELS[stepType]) {
            if (!groupMap.has(stepType)) {
                groupMap.set(stepType, {
                    builtInType: stepType,
                    label: BUILT_IN_LABELS[stepType]!,
                    steps: []
                });
            }
            groupMap.get(stepType)!.steps.push(stepType);
        } else {
            const parentType = stepType.split(":")[1] ?? stepType;
            if (!groupMap.has(parentType)) {
                groupMap.set(parentType, {
                    builtInType: parentType,
                    label: BUILT_IN_LABELS[parentType] ?? parentType,
                    steps: []
                });
            }
            groupMap.get(parentType)!.steps.push(stepType);
        }
    }

    return Array.from(groupMap.values());
}

function renderStep(
    stepType: string,
    presenter: UpgradeWizardPresenter.Interface,
    projectId: string
): React.ReactNode {
    switch (stepType) {
        case "select-packages":
            return <SelectPackagesStep presenter={presenter} projectId={projectId} />;
        case "branch":
            return <BranchStep presenter={presenter} />;
        case "upgrade":
            return <UpgradeStep presenter={presenter} />;
        case "refresh-transient":
            return <RefreshTransientStep presenter={presenter} />;
        case "commit":
            return <CommitStep presenter={presenter} />;
        case "push":
            return <PushStep presenter={presenter} />;
        case "create-pr":
            return <PrStep presenter={presenter} />;
        default:
            return <CustomStep presenter={presenter} stepType={stepType} />;
    }
}

export const UpgradeWizardPage = observer(function UpgradeWizardPage({
    presenter,
    projectId
}: UpgradeWizardPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        presenter.load(projectId);
    }, [presenter, projectId]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    const stepOrder = vm.session?.stepOrder ?? [];
    const groups = useMemo(() => groupSteps(stepOrder), [stepOrder]);

    if (vm.loading && !vm.session) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    const activeGroupIndex = vm.activeStep
        ? groups.findIndex(group => group.steps.includes(vm.activeStep!.type))
        : groups.length;

    const isCompleted = vm.session?.status === "completed";
    const isActive = vm.session?.status === "active";

    return (
        <Stack gap="md">
            <Group gap="sm" justify="space-between">
                <Group gap="sm">
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        onClick={() => navigate(`/Projects/${projectId}`)}
                    >
                        &larr;
                    </ActionIcon>
                    <Title order={2}>Upgrade: {vm.projectName}</Title>
                </Group>
                {isActive && (
                    <Button color="red" variant="outline" onClick={() => presenter.abort()}>
                        Abort
                    </Button>
                )}
            </Group>

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            {isCompleted && (
                <Alert color="green" title="Upgrade Complete">
                    All steps have completed successfully.
                </Alert>
            )}

            <Stepper active={activeGroupIndex} allowNextStepsSelect={false}>
                {groups.map(group => (
                    <Stepper.Step key={group.builtInType} label={group.label} />
                ))}
            </Stepper>

            {vm.activeStep
                ? renderStep(vm.activeStep.type, presenter, projectId)
                : !isCompleted && <Text>No active step.</Text>}
        </Stack>
    );
});
