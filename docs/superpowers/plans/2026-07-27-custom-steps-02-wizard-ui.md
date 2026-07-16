# Custom Steps Part 2: Wizard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the upgrade wizard UI to render dynamic step pipelines with custom steps grouped under their parent built-in steps.

**Architecture:** Replace hardcoded `STEP_DEFINITIONS` and switch/case rendering with dynamic stepper built from session's `stepOrder`. Add `CustomStep` component for rendering custom step execution with live logs. Group custom steps as sub-steps under their parent built-in step in the Mantine Stepper.

**Tech Stack:** TypeScript, React, Mantine, MobX, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- Follow existing presentation layer patterns (presenter + observer components)

**Depends on:** `2026-07-27-custom-steps-01-backend-core.md` — requires `stepOrder` in session response and `IUpgradeStepState.input` containing custom step metadata.

---

### Task 1: CustomStep Component

**Files:**

- Create: `src/ui/presentation/projects/UpgradeWizard/components/CustomStep.tsx`

**Interfaces:**

- Consumes:
  - `UpgradeWizardPresenter.Interface` — `vm`, `executeStep(stepType, input)`, `skipStep(stepType)`
  - `IUpgradeStepState` — `type`, `status`, `input.name`, `input.command`
- Produces: `CustomStep` React component with props `{ presenter, stepType }`

- [ ] **Step 1: Create CustomStep component**

```tsx
// src/ui/presentation/projects/UpgradeWizard/components/CustomStep.tsx
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

      {step?.status === "skipped" && step.result["error"] && (
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
```

- [ ] **Step 2: Verify it compiles**

Run: `yarn tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/projects/UpgradeWizard/components/CustomStep.tsx
git commit -m "feat: add CustomStep component for custom wizard steps"
```

---

### Task 2: Dynamic Stepper in UpgradeWizardPage

**Files:**

- Modify: `src/ui/presentation/projects/UpgradeWizard/components/UpgradeWizardPage.tsx`

**Interfaces:**

- Consumes:
  - `UpgradeWizardPresenter.ViewModel` — `session.stepOrder`, `session.steps`, `activeStep`
  - `CustomStep` component from Task 1
  - Built-in step components: `SelectPackagesStep`, `BranchStep`, `UpgradeStep`, `RefreshTransientStep`, `CommitStep`
- Produces: Dynamic stepper with grouped custom steps

- [ ] **Step 1: Replace UpgradeWizardPage with dynamic rendering**

Replace the full content of `src/ui/presentation/projects/UpgradeWizard/components/UpgradeWizardPage.tsx`:

```tsx
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
import { navigate } from "#ui/shared/router/router.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";
import { SelectPackagesStep } from "./SelectPackagesStep.js";
import { BranchStep } from "./BranchStep.js";
import { UpgradeStep } from "./UpgradeStep.js";
import { RefreshTransientStep } from "./RefreshTransientStep.js";
import { CommitStep } from "./CommitStep.js";
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
  commit: "Commit"
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
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate(`/projects/${projectId}`)}>
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
```

- [ ] **Step 2: Update UpgradeWizardPresenter ViewModel**

In `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`, the `IUpgradeWizardViewModel` already has `session` which now includes `stepOrder` from the gateway type change in Part 1. No code change needed — verify the type flows through.

- [ ] **Step 3: Verify it compiles**

Run: `yarn tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Run full test suite**

Run: `yarn vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/UpgradeWizard/components/UpgradeWizardPage.tsx
git commit -m "feat: dynamic wizard stepper with grouped custom steps

Replaces hardcoded STEP_DEFINITIONS with dynamic groups built from
session stepOrder. Custom steps render via CustomStep component.
Built-in steps render their existing components."
```
