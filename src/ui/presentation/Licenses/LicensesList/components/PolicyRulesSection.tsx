import type React from "react";
import { Accordion, ActionIcon, Badge, Button, Group, Stack, Table } from "@mantine/core";
import type { LicensesPresenter } from "../abstractions/LicensesPresenter.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";

interface PolicyRulesSectionProps {
    rules: LicensesPresenter.PolicyRule[];
    deletingRuleId: string | null;
    onAdd: () => void;
    onEdit: (rule: LicensesPresenter.PolicyRule) => void;
    onDelete: (ruleId: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
}

export function PolicyRulesSection({
    rules,
    deletingRuleId,
    onAdd,
    onEdit,
    onDelete,
    onConfirmDelete,
    onCancelDelete
}: PolicyRulesSectionProps): React.ReactNode {
    return (
        <>
            <Accordion>
                <Accordion.Item value="policy-rules">
                    <Accordion.Control>Policy Rules ({rules.length})</Accordion.Control>
                    <Accordion.Panel>
                        <Stack>
                            <Group justify="flex-end">
                                <Button size="xs" onClick={onAdd}>
                                    Add Rule
                                </Button>
                            </Group>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Action</Table.Th>
                                        <Table.Th>License Pattern</Table.Th>
                                        <Table.Th>Package Pattern</Table.Th>
                                        <Table.Th>Project</Table.Th>
                                        <Table.Th>Priority</Table.Th>
                                        <Table.Th>Reason</Table.Th>
                                        <Table.Th />
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rules.map(rule => (
                                        <Table.Tr key={rule.id}>
                                            <Table.Td>
                                                <Badge
                                                    color={
                                                        rule.action === "deny"
                                                            ? "red"
                                                            : rule.action === "warn"
                                                              ? "yellow"
                                                              : "green"
                                                    }
                                                >
                                                    {rule.action}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>{rule.licensePattern ?? "—"}</Table.Td>
                                            <Table.Td>{rule.packagePattern ?? "—"}</Table.Td>
                                            <Table.Td>{rule.projectId ?? "—"}</Table.Td>
                                            <Table.Td>{rule.priority}</Table.Td>
                                            <Table.Td>{rule.reason ?? "—"}</Table.Td>
                                            <Table.Td>
                                                <Group gap="xs" wrap="nowrap">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        onClick={() => onEdit(rule)}
                                                    >
                                                        ✎
                                                    </ActionIcon>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        onClick={() => onDelete(rule.id)}
                                                    >
                                                        ✕
                                                    </ActionIcon>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Stack>
                    </Accordion.Panel>
                </Accordion.Item>
            </Accordion>

            <ConfirmDialog
                opened={deletingRuleId !== null}
                title="Delete Policy Rule"
                message="Delete this policy rule? This cannot be undone."
                confirmLabel="Delete"
                onConfirm={onConfirmDelete}
                onCancel={onCancelDelete}
            />
        </>
    );
}
