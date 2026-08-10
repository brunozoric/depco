import type React from "react";
import { Button, Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";

const POLICY_ACTION_SELECT_DATA = LICENSE_POLICY_ACTIONS.map(action => ({
    value: action,
    label: action
}));

export interface PolicyRuleFormState {
    action: LicensePolicyAction;
    licensePattern: string;
    packagePattern: string;
    projectId: string;
    priority: number;
    reason: string;
}

export const EMPTY_POLICY_RULE_FORM_STATE: PolicyRuleFormState = {
    action: "warn",
    licensePattern: "",
    packagePattern: "",
    projectId: "",
    priority: 0,
    reason: ""
};

interface PolicyRuleModalProps {
    opened: boolean;
    editing: boolean;
    formState: PolicyRuleFormState;
    saving: boolean;
    onFormStateChange: (updater: (current: PolicyRuleFormState) => PolicyRuleFormState) => void;
    onSave: () => void;
    onClose: () => void;
}

export function PolicyRuleModal({
    opened,
    editing,
    formState,
    saving,
    onFormStateChange,
    onSave,
    onClose
}: PolicyRuleModalProps): React.ReactNode {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={editing ? "Edit Policy Rule" : "Add Policy Rule"}
        >
            <Stack>
                <Select
                    label="Action"
                    data={POLICY_ACTION_SELECT_DATA}
                    value={formState.action}
                    onChange={value =>
                        onFormStateChange(current => ({
                            ...current,
                            action: (value ?? "warn") as LicensePolicyAction
                        }))
                    }
                />
                <TextInput
                    label="License Pattern"
                    placeholder="e.g. GPL-*"
                    value={formState.licensePattern}
                    onChange={event =>
                        onFormStateChange(current => ({
                            ...current,
                            licensePattern: event.currentTarget.value
                        }))
                    }
                />
                <TextInput
                    label="Package Pattern"
                    placeholder="e.g. @scope/*"
                    value={formState.packagePattern}
                    onChange={event =>
                        onFormStateChange(current => ({
                            ...current,
                            packagePattern: event.currentTarget.value
                        }))
                    }
                />
                <TextInput
                    label="Project"
                    placeholder="Leave blank to apply to all projects"
                    value={formState.projectId}
                    onChange={event =>
                        onFormStateChange(current => ({
                            ...current,
                            projectId: event.currentTarget.value
                        }))
                    }
                />
                <NumberInput
                    label="Priority"
                    value={formState.priority}
                    onChange={value =>
                        onFormStateChange(current => ({
                            ...current,
                            priority: typeof value === "number" ? value : 0
                        }))
                    }
                />
                <TextInput
                    label="Reason"
                    value={formState.reason}
                    onChange={event =>
                        onFormStateChange(current => ({
                            ...current,
                            reason: event.currentTarget.value
                        }))
                    }
                />
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button loading={saving} onClick={onSave}>
                        Save
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
