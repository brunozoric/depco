import type React from "react";
import { Group, Select, TextInput } from "@mantine/core";
import { RISK_TIER_VALUES } from "#shared/licenses/types.js";

const RISK_TIER_SELECT_DATA = RISK_TIER_VALUES.map(tier => ({ value: tier, label: tier }));

const VIOLATION_SELECT_DATA = [
    { value: "warn", label: "Warn" },
    { value: "deny", label: "Deny" }
];

interface LicensesFiltersProps {
    riskTierFilter: string | null;
    packageNameFilter: string;
    projectIdFilter: string | null;
    violationFilter: string | null;
    availableProjects: Array<{ id: string; name: string }>;
    onRiskTierChange: (value: string | null) => void;
    onPackageNameChange: (value: string) => void;
    onProjectIdChange: (value: string | null) => void;
    onViolationChange: (value: string | null) => void;
}

export function LicensesFilters({
    riskTierFilter,
    packageNameFilter,
    projectIdFilter,
    violationFilter,
    availableProjects,
    onRiskTierChange,
    onPackageNameChange,
    onProjectIdChange,
    onViolationChange
}: LicensesFiltersProps): React.ReactNode {
    return (
        <Group>
            <Select
                placeholder="Risk tier"
                clearable
                value={riskTierFilter}
                onChange={onRiskTierChange}
                data={RISK_TIER_SELECT_DATA}
            />
            <TextInput
                placeholder="Package name"
                value={packageNameFilter}
                onChange={event => onPackageNameChange(event.currentTarget.value)}
            />
            <Select
                placeholder="Project"
                clearable
                searchable
                value={projectIdFilter}
                onChange={onProjectIdChange}
                data={availableProjects.map(project => ({
                    value: project.id,
                    label: project.name
                }))}
            />
            <Select
                placeholder="Violation"
                clearable
                value={violationFilter}
                onChange={onViolationChange}
                data={VIOLATION_SELECT_DATA}
            />
        </Group>
    );
}
