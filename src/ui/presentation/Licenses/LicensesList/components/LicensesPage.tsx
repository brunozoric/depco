import type React from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    Title,
    Group,
    Table,
    Badge,
    Text,
    Select,
    TextInput,
    NumberInput,
    Button,
    Card,
    SimpleGrid,
    Accordion,
    Modal,
    Skeleton,
    ActionIcon,
    Pagination
} from "@mantine/core";
import type { LicensesPresenter } from "../abstractions/LicensesPresenter.js";
import type { LicensesGateway } from "#ui/features/Licenses/abstractions/LicensesGateway.js";
import { RISK_TIER_VALUES, LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";
import { RISK_TIER_COLORS } from "#ui/shared/licenses/riskTierColors.js";
import { ConfirmDialog } from "#ui/shared/components/ConfirmDialog.js";
import { SortableHeader } from "#ui/shared/components/SortableHeader.js";

interface LicensesPageProps {
    presenter: LicensesPresenter.Interface;
}

interface PolicyRuleFormState {
    action: LicensePolicyAction;
    licensePattern: string;
    packagePattern: string;
    projectId: string;
    priority: number;
    reason: string;
}

const EMPTY_POLICY_RULE_FORM_STATE: PolicyRuleFormState = {
    action: "warn",
    licensePattern: "",
    packagePattern: "",
    projectId: "",
    priority: 0,
    reason: ""
};

const VIOLATION_COLORS: Record<"warn" | "deny", string> = {
    warn: "yellow",
    deny: "red"
};

const RISK_TIER_SELECT_DATA = RISK_TIER_VALUES.map(tier => ({ value: tier, label: tier }));

const POLICY_ACTION_SELECT_DATA = LICENSE_POLICY_ACTIONS.map(action => ({
    value: action,
    label: action
}));

const VIOLATION_SELECT_DATA = [
    { value: "warn", label: "Warn" },
    { value: "deny", label: "Deny" }
];

function policyRuleToFormState(rule: LicensesPresenter.PolicyRule): PolicyRuleFormState {
    return {
        action: rule.action,
        licensePattern: rule.licensePattern ?? "",
        packagePattern: rule.packagePattern ?? "",
        projectId: rule.projectId ?? "",
        priority: rule.priority,
        reason: rule.reason ?? ""
    };
}

function policyRuleFormStateToInput(
    formState: PolicyRuleFormState
): LicensesGateway.CreatePolicyInput {
    return {
        action: formState.action,
        licensePattern:
            formState.licensePattern.trim() === "" ? null : formState.licensePattern.trim(),
        packagePattern:
            formState.packagePattern.trim() === "" ? null : formState.packagePattern.trim(),
        projectId: formState.projectId.trim() === "" ? null : formState.projectId.trim(),
        priority: formState.priority,
        reason: formState.reason.trim() === "" ? null : formState.reason.trim()
    };
}

export const LicensesPage = observer(function LicensesPage({
    presenter
}: LicensesPageProps): React.ReactNode {
    const [scanningProjectId, setScanningProjectId] = useState<string | null>(null);
    const [policyRuleModalOpened, setPolicyRuleModalOpened] = useState(false);
    const [editingPolicyRuleId, setEditingPolicyRuleId] = useState<string | null>(null);
    const [policyRuleFormState, setPolicyRuleFormState] = useState<PolicyRuleFormState>(
        EMPTY_POLICY_RULE_FORM_STATE
    );
    const [policyRuleSaving, setPolicyRuleSaving] = useState(false);
    const [deletingPolicyRuleId, setDeletingPolicyRuleId] = useState<string | null>(null);

    useEffect(() => {
        void presenter.load();
        return () => presenter.dispose();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading && vm.licenses.length === 0) {
        return (
            <Stack>
                <Title order={2}>Licenses</Title>
                <Skeleton height={100} />
                <Skeleton height={40} />
                <Skeleton height={300} />
            </Stack>
        );
    }

    if (vm.error) {
        return (
            <Stack>
                <Title order={2}>Licenses</Title>
                <Text c="red">{vm.error}</Text>
            </Stack>
        );
    }

    function openAddPolicyRuleModal(): void {
        setEditingPolicyRuleId(null);
        setPolicyRuleFormState(EMPTY_POLICY_RULE_FORM_STATE);
        setPolicyRuleModalOpened(true);
    }

    function openEditPolicyRuleModal(rule: LicensesPresenter.PolicyRule): void {
        setEditingPolicyRuleId(rule.id);
        setPolicyRuleFormState(policyRuleToFormState(rule));
        setPolicyRuleModalOpened(true);
    }

    function closePolicyRuleModal(): void {
        setPolicyRuleModalOpened(false);
        setEditingPolicyRuleId(null);
    }

    async function handleSavePolicyRule(): Promise<void> {
        setPolicyRuleSaving(true);
        try {
            const input = policyRuleFormStateToInput(policyRuleFormState);
            if (editingPolicyRuleId) {
                await presenter.updateRule(editingPolicyRuleId, input);
            } else {
                await presenter.createRule(input);
            }
            closePolicyRuleModal();
        } finally {
            setPolicyRuleSaving(false);
        }
    }

    async function handleScanProject(projectId: string): Promise<void> {
        setScanningProjectId(projectId);
        try {
            await presenter.scanProject(projectId);
        } finally {
            setScanningProjectId(null);
        }
    }

    return (
        <Stack>
            <Title order={2}>Licenses</Title>

            {vm.summary && (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Total Packages
                        </Text>
                        <Text size="xl" fw={700}>
                            {vm.summary.totalPackages}
                        </Text>
                    </Card>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Compliant
                        </Text>
                        <Text size="xl" fw={700}>
                            {vm.summary.compliantPercent}%
                        </Text>
                    </Card>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Deny Violations
                        </Text>
                        <Text size="xl" fw={700} c="red">
                            {vm.summary.denyCount}
                        </Text>
                    </Card>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Warn Violations
                        </Text>
                        <Text size="xl" fw={700} c="yellow.8">
                            {vm.summary.warnCount}
                        </Text>
                    </Card>
                </SimpleGrid>
            )}

            <Group>
                <Select
                    placeholder="Risk tier"
                    clearable
                    value={vm.riskTierFilter}
                    onChange={value => presenter.setRiskTierFilter(value)}
                    data={RISK_TIER_SELECT_DATA}
                />
                <TextInput
                    placeholder="Package name"
                    value={vm.packageNameFilter}
                    onChange={event => presenter.setPackageNameFilter(event.currentTarget.value)}
                />
                <Select
                    placeholder="Project"
                    clearable
                    searchable
                    value={vm.projectIdFilter}
                    onChange={value => presenter.setProjectIdFilter(value)}
                    data={vm.availableProjects.map(project => ({
                        value: project.id,
                        label: project.name
                    }))}
                />
                <Select
                    placeholder="Violation"
                    clearable
                    value={vm.violationFilter}
                    onChange={value => presenter.setViolationFilter(value)}
                    data={VIOLATION_SELECT_DATA}
                />
            </Group>

            {vm.availableProjects.length > 0 && (
                <Group gap="xs">
                    <Text size="sm" fw={600}>
                        Scan:
                    </Text>
                    {vm.availableProjects.map(project => (
                        <Button
                            key={project.id}
                            size="xs"
                            variant="light"
                            loading={scanningProjectId === project.id}
                            onClick={() => void handleScanProject(project.id)}
                        >
                            {project.name}
                        </Button>
                    ))}
                </Group>
            )}

            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>
                            <SortableHeader
                                label="Package"
                                sortKey="packageName"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={field => presenter.setSortBy(field)}
                            />
                        </Table.Th>
                        <Table.Th>
                            <SortableHeader
                                label="License"
                                sortKey="licenseName"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={field => presenter.setSortBy(field)}
                            />
                        </Table.Th>
                        <Table.Th>SPDX</Table.Th>
                        <Table.Th>
                            <SortableHeader
                                label="Risk Tier"
                                sortKey="riskTier"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={field => presenter.setSortBy(field)}
                            />
                        </Table.Th>
                        <Table.Th>
                            <SortableHeader
                                label="Project"
                                sortKey="projectName"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={field => presenter.setSortBy(field)}
                            />
                        </Table.Th>
                        <Table.Th>Violation</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.licenses.map(license => (
                        <Table.Tr key={license.id}>
                            <Table.Td>{license.packageName}</Table.Td>
                            <Table.Td>{license.licenseName}</Table.Td>
                            <Table.Td>{license.spdxId ?? "—"}</Table.Td>
                            <Table.Td>
                                <Badge color={RISK_TIER_COLORS[license.riskTier]}>
                                    {license.riskTier}
                                </Badge>
                            </Table.Td>
                            <Table.Td>{license.projectName}</Table.Td>
                            <Table.Td>
                                {license.violationAction ? (
                                    <Badge color={VIOLATION_COLORS[license.violationAction]}>
                                        {license.violationAction}
                                    </Badge>
                                ) : (
                                    "—"
                                )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>

            {vm.totalPages > 1 && (
                <Pagination
                    total={vm.totalPages}
                    value={vm.page}
                    onChange={page => presenter.setPage(page)}
                />
            )}

            <Accordion>
                <Accordion.Item value="policy-rules">
                    <Accordion.Control>Policy Rules ({vm.policyRules.length})</Accordion.Control>
                    <Accordion.Panel>
                        <Stack>
                            <Group justify="flex-end">
                                <Button size="xs" onClick={openAddPolicyRuleModal}>
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
                                    {vm.policyRules.map(rule => (
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
                                                        onClick={() =>
                                                            openEditPolicyRuleModal(rule)
                                                        }
                                                    >
                                                        ✎
                                                    </ActionIcon>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        onClick={() =>
                                                            setDeletingPolicyRuleId(rule.id)
                                                        }
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

            <Modal
                opened={policyRuleModalOpened}
                onClose={closePolicyRuleModal}
                title={editingPolicyRuleId ? "Edit Policy Rule" : "Add Policy Rule"}
            >
                <Stack>
                    <Select
                        label="Action"
                        data={POLICY_ACTION_SELECT_DATA}
                        value={policyRuleFormState.action}
                        onChange={value =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                action: (value ?? "warn") as LicensePolicyAction
                            }))
                        }
                    />
                    <TextInput
                        label="License Pattern"
                        placeholder="e.g. GPL-*"
                        value={policyRuleFormState.licensePattern}
                        onChange={event =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                licensePattern: event.currentTarget.value
                            }))
                        }
                    />
                    <TextInput
                        label="Package Pattern"
                        placeholder="e.g. @scope/*"
                        value={policyRuleFormState.packagePattern}
                        onChange={event =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                packagePattern: event.currentTarget.value
                            }))
                        }
                    />
                    <TextInput
                        label="Project"
                        placeholder="Leave blank to apply to all projects"
                        value={policyRuleFormState.projectId}
                        onChange={event =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                projectId: event.currentTarget.value
                            }))
                        }
                    />
                    <NumberInput
                        label="Priority"
                        value={policyRuleFormState.priority}
                        onChange={value =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                priority: typeof value === "number" ? value : 0
                            }))
                        }
                    />
                    <TextInput
                        label="Reason"
                        value={policyRuleFormState.reason}
                        onChange={event =>
                            setPolicyRuleFormState(current => ({
                                ...current,
                                reason: event.currentTarget.value
                            }))
                        }
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closePolicyRuleModal}>
                            Cancel
                        </Button>
                        <Button
                            loading={policyRuleSaving}
                            onClick={() => void handleSavePolicyRule()}
                        >
                            Save
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <ConfirmDialog
                opened={deletingPolicyRuleId !== null}
                title="Delete Policy Rule"
                message="Delete this policy rule? This cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    const ruleId = deletingPolicyRuleId;
                    setDeletingPolicyRuleId(null);
                    if (ruleId) {
                        void presenter.deleteRule(ruleId);
                    }
                }}
                onCancel={() => setDeletingPolicyRuleId(null)}
            />
        </Stack>
    );
});
