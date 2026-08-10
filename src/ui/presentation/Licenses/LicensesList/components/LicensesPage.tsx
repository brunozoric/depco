import type React from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Stack, Title, Group, Button, Text, Skeleton, Pagination } from "@mantine/core";
import type { LicensesPresenter } from "../abstractions/LicensesPresenter.js";
import type { LicensesGateway } from "#ui/features/Licenses/abstractions/LicensesGateway.js";
import { LicensesSummaryCards } from "./LicensesSummaryCards.js";
import { LicensesFilters } from "./LicensesFilters.js";
import { LicensesTable } from "./LicensesTable.js";
import {
    PolicyRuleModal,
    EMPTY_POLICY_RULE_FORM_STATE,
    type PolicyRuleFormState
} from "./PolicyRuleModal.js";
import { PolicyRulesSection } from "./PolicyRulesSection.js";

interface LicensesPageProps {
    presenter: LicensesPresenter.Interface;
}

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

            {vm.summary && <LicensesSummaryCards summary={vm.summary} />}

            <LicensesFilters
                riskTierFilter={vm.riskTierFilter}
                packageNameFilter={vm.packageNameFilter}
                projectIdFilter={vm.projectIdFilter}
                violationFilter={vm.violationFilter}
                availableProjects={vm.availableProjects}
                onRiskTierChange={value => presenter.setRiskTierFilter(value)}
                onPackageNameChange={value => presenter.setPackageNameFilter(value)}
                onProjectIdChange={value => presenter.setProjectIdFilter(value)}
                onViolationChange={value => presenter.setViolationFilter(value)}
            />

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

            <LicensesTable
                licenses={vm.licenses}
                sortBy={vm.sortBy}
                sortOrder={vm.sortOrder}
                onSort={field => presenter.setSortBy(field)}
            />

            {vm.totalPages > 1 && (
                <Pagination
                    total={vm.totalPages}
                    value={vm.page}
                    onChange={page => presenter.setPage(page)}
                />
            )}

            <PolicyRulesSection
                rules={vm.policyRules}
                deletingRuleId={deletingPolicyRuleId}
                onAdd={openAddPolicyRuleModal}
                onEdit={openEditPolicyRuleModal}
                onDelete={setDeletingPolicyRuleId}
                onConfirmDelete={() => {
                    const ruleId = deletingPolicyRuleId;
                    setDeletingPolicyRuleId(null);
                    if (ruleId) {
                        void presenter.deleteRule(ruleId);
                    }
                }}
                onCancelDelete={() => setDeletingPolicyRuleId(null)}
            />

            <PolicyRuleModal
                opened={policyRuleModalOpened}
                editing={editingPolicyRuleId !== null}
                formState={policyRuleFormState}
                saving={policyRuleSaving}
                onFormStateChange={setPolicyRuleFormState}
                onSave={() => void handleSavePolicyRule()}
                onClose={closePolicyRuleModal}
            />
        </Stack>
    );
});
