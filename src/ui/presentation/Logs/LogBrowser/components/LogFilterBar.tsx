import type React from "react";
import { Button, Group, Select, TextInput } from "@mantine/core";
import {
    epochMsToDatetimeLocal,
    datetimeLocalToEpochMs
} from "#ui/infrastructure/Shared/formatting/datetimeConverters.js";

const LEVEL_OPTIONS = [
    { label: "Error", value: "error" },
    { label: "Warning", value: "warn" },
    { label: "Info", value: "info" }
];

const SOURCE_OPTIONS = [
    { label: "Scan", value: "scan" },
    { label: "Upgrade", value: "upgrade" },
    { label: "Install", value: "install" },
    { label: "Step Resolver", value: "step-resolver" },
    { label: "Git", value: "git" },
    { label: "Clone", value: "clone" }
];

interface ProjectOption {
    label: string;
    value: string;
}

interface LogFilterBarProps {
    levelFilter: string | null;
    sourceFilter: string | null;
    projectFilter: string | null;
    projects: ProjectOption[];
    dateFrom: string | null;
    dateTo: string | null;
    onFilterChange: (field: string, value: string | null) => void;
    onClearFilters: () => void;
}

export function LogFilterBar({
    levelFilter,
    sourceFilter,
    projectFilter,
    projects,
    dateFrom,
    dateTo,
    onFilterChange,
    onClearFilters
}: LogFilterBarProps): React.ReactNode {
    return (
        <Group gap="sm">
            <Select
                size="xs"
                placeholder="Level"
                data={LEVEL_OPTIONS}
                value={levelFilter}
                onChange={value => onFilterChange("level", value)}
                clearable
                style={{ width: 130 }}
            />
            <Select
                size="xs"
                placeholder="Source"
                data={SOURCE_OPTIONS}
                value={sourceFilter}
                onChange={value => onFilterChange("source", value)}
                clearable
                style={{ width: 150 }}
            />
            <Select
                size="xs"
                placeholder="Project"
                data={projects}
                value={projectFilter}
                onChange={value => onFilterChange("project", value)}
                clearable
                searchable
                style={{ width: 180 }}
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
            <Button size="xs" variant="subtle" onClick={() => onClearFilters()}>
                Clear
            </Button>
        </Group>
    );
}
