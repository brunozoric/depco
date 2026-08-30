import type React from "react";
import { Button, Group, Select, TextInput } from "@mantine/core";
import {
    epochMsToDatetimeLocal,
    datetimeLocalToEpochMs
} from "#ui/infrastructure/Shared/formatting/datetimeConverters.js";

const TYPE_OPTIONS = [
    { label: "Scan", value: "scan" },
    { label: "Package Scan", value: "package-scan" },
    { label: "Dependency", value: "dependency" },
    { label: "Transient", value: "transient" },
    { label: "Transitive Resolve", value: "transitive-resolve" },
    { label: "Vulnerability Scan", value: "vulnerability-scan" },
    { label: "License Scan", value: "license-scan" },
    { label: "Graph Refresh", value: "graph-refresh" },
    { label: "Install", value: "install" },
    { label: "Clone", value: "clone" },
    { label: "Package Manager", value: "packageManager" },
    { label: "Changelog", value: "changelog" },
    { label: "Auto-Fix PR", value: "auto-fix-pr" }
];

interface ISelectOption {
    value: string;
    label: string;
}

interface IJobsFilterBarProps {
    typeFilter: string | null;
    referenceFilter: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    references: ISelectOption[];
    onFilterChange: (key: string, value: string | null) => void;
    onClear: () => void;
}

export function JobsFilterBar({
    typeFilter,
    referenceFilter,
    dateFrom,
    dateTo,
    references,
    onFilterChange,
    onClear
}: IJobsFilterBarProps): React.ReactNode {
    return (
        <Group gap="sm">
            <Select
                size="xs"
                placeholder="Type"
                data={TYPE_OPTIONS}
                value={typeFilter}
                onChange={value => onFilterChange("type", value)}
                clearable
                style={{ width: 160 }}
            />
            <Select
                size="xs"
                placeholder="Reference"
                data={references}
                value={referenceFilter}
                onChange={value => onFilterChange("reference", value)}
                clearable
                searchable
                style={{ width: 200 }}
            />
            <TextInput
                type="datetime-local"
                size="xs"
                placeholder="From"
                value={epochMsToDatetimeLocal(dateFrom)}
                onChange={e =>
                    onFilterChange("dateFrom", datetimeLocalToEpochMs(e.currentTarget.value))
                }
                style={{ width: 200 }}
            />
            <TextInput
                type="datetime-local"
                size="xs"
                placeholder="To"
                value={epochMsToDatetimeLocal(dateTo)}
                onChange={e =>
                    onFilterChange("dateTo", datetimeLocalToEpochMs(e.currentTarget.value))
                }
                style={{ width: 200 }}
            />
            <Button size="xs" variant="subtle" onClick={onClear}>
                Clear
            </Button>
        </Group>
    );
}
