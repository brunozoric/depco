import type React from "react";
import { useEffect } from "react";
import { ActionIcon, Alert, Button, Group, Stack, Title } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";
import { StepHookList } from "./StepHookList.js";
import { StepHookForm } from "./StepHookForm.js";
import { DiscoveredScriptsList } from "./DiscoveredScriptsList.js";

interface StepHooksPageProps {
    presenter: StepHooksPresenter.Interface;
    projectId: string;
}

export const StepHooksPage = observer(function StepHooksPage({
    presenter,
    projectId
}: StepHooksPageProps): React.ReactNode {
    const { vm } = presenter;
    const readOnly = vm.configSource === "file";

    useEffect(() => {
        void presenter.load(projectId);
    }, [presenter, projectId]);

    const handleAddScript = (name: string, command: string): void => {
        presenter.openFormWithDefaults({ name, command, type: "package-script" });
    };

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Group gap="sm">
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        onClick={() => navigate(`/Projects/${projectId}`)}
                    >
                        &larr;
                    </ActionIcon>
                    <Title order={3}>Step Hooks</Title>
                </Group>
                {!readOnly && <Button onClick={() => presenter.openForm()}>Add Hook</Button>}
            </Group>

            {readOnly && (
                <Alert color="blue" title="File-managed hooks">
                    Step hooks are managed by .dependency-upgrader.json. Edit the config file to
                    modify hooks.
                </Alert>
            )}

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            <StepHookList
                hooks={vm.hooks}
                onToggleEnabled={presenter.toggleEnabled}
                onEdit={id => presenter.openForm(id)}
                onDelete={presenter.remove}
            />

            <DiscoveredScriptsList
                scripts={vm.discoveredScripts}
                configSource={vm.configSource}
                onAdd={handleAddScript}
            />

            {!readOnly && (
                <StepHookForm
                    opened={vm.formOpen}
                    editingHook={
                        vm.editingHookId ? vm.hooks.find(h => h.id === vm.editingHookId) : undefined
                    }
                    defaults={vm.formDefaults}
                    onSubmit={async input => {
                        if (vm.editingHookId) {
                            await presenter.update(vm.editingHookId, input);
                        } else {
                            await presenter.create(input);
                        }
                    }}
                    onClose={presenter.closeForm}
                />
            )}
        </Stack>
    );
});
