import type React from "react";
import { useEffect, useState } from "react";
import { Button, Group, Modal, Select, Stack, Switch, TextInput } from "@mantine/core";
import type { StepHooksGateway } from "../../../../features/StepHooks/abstractions/StepHooksGateway.js";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";

const POSITION_OPTIONS = [
    { label: "Before: Select Packages", value: "pre:select-packages" },
    { label: "After: Select Packages", value: "post:select-packages" },
    { label: "Before: Branch", value: "pre:branch" },
    { label: "After: Branch", value: "post:branch" },
    { label: "Before: Upgrade", value: "pre:upgrade" },
    { label: "After: Upgrade", value: "post:upgrade" },
    { label: "Before: Refresh Transient", value: "pre:refresh-transient" },
    { label: "After: Refresh Transient", value: "post:refresh-transient" },
    { label: "Before: Commit", value: "pre:commit" },
    { label: "After: Commit", value: "post:commit" }
];

const TYPE_OPTIONS = [
    { label: "Command", value: "command" },
    { label: "Script", value: "script" },
    { label: "Package Script", value: "package-script" }
];

const DEFAULT_POSITION = POSITION_OPTIONS[0]?.value ?? "pre:select-packages";
const DEFAULT_TYPE: StepHooksGateway.CreateInput["type"] = "command";

interface StepHookFormProps {
    opened: boolean;
    editingHook: StepHooksPresenter.HookViewModel | undefined;
    defaults: StepHooksPresenter.FormDefaults | null;
    onSubmit: (input: StepHooksGateway.CreateInput) => Promise<void>;
    onClose: () => void;
}

export function StepHookForm({
    opened,
    editingHook,
    defaults,
    onSubmit,
    onClose
}: StepHookFormProps): React.ReactNode {
    const [position, setPosition] = useState<string>(DEFAULT_POSITION);
    const [name, setName] = useState("");
    const [command, setCommand] = useState("");
    const [type, setType] = useState<StepHooksGateway.CreateInput["type"]>(DEFAULT_TYPE);
    const [required, setRequired] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!opened) {
            return;
        }
        if (editingHook) {
            setPosition(editingHook.position);
            setName(editingHook.name);
            setCommand(editingHook.command);
            setType(editingHook.type);
            setRequired(editingHook.required);
        } else if (defaults) {
            setPosition(DEFAULT_POSITION);
            setName(defaults.name);
            setCommand(defaults.command);
            setType(defaults.type);
            setRequired(false);
        } else {
            setPosition(DEFAULT_POSITION);
            setName("");
            setCommand("");
            setType(DEFAULT_TYPE);
            setRequired(false);
        }
    }, [opened, editingHook, defaults]);

    const handleSubmit = async (): Promise<void> => {
        setSubmitting(true);
        try {
            await onSubmit({ position, name, command, type, required });
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = name.trim().length > 0 && command.trim().length > 0;

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={editingHook ? "Edit Step Hook" : "Add Step Hook"}
            size="md"
        >
            <Stack gap="md">
                <Select
                    label="Position"
                    data={POSITION_OPTIONS}
                    value={position}
                    onChange={value => value && setPosition(value)}
                    disabled={!!editingHook}
                    allowDeselect={false}
                />
                <TextInput
                    label="Name"
                    value={name}
                    onChange={event => setName(event.currentTarget.value)}
                />
                <TextInput
                    label="Command"
                    value={command}
                    onChange={event => setCommand(event.currentTarget.value)}
                />
                <Select
                    label="Type"
                    data={TYPE_OPTIONS}
                    value={type}
                    onChange={value =>
                        value && setType(value as StepHooksGateway.CreateInput["type"])
                    }
                    allowDeselect={false}
                />
                <Switch
                    label="Required"
                    checked={required}
                    onChange={event => setRequired(event.currentTarget.checked)}
                />
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        loading={submitting}
                        disabled={!canSubmit}
                    >
                        {editingHook ? "Save" : "Add"}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
