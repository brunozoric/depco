import type React from "react";
import { Button, Group, Select, TextInput } from "@mantine/core";

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

// Converts an epoch-ms string (as stored by the presenter) into the local
// "YYYY-MM-DDTHH:mm" format expected by <input type="datetime-local">.
function epochMsToDatetimeLocal(value: string | null): string {
    if (!value) {
        return "";
    }
    const ms = Number(value);
    if (Number.isNaN(ms)) {
        return "";
    }
    const date = new Date(ms);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Converts a datetime-local input value back into an epoch-ms string, or
// null when the input was cleared / invalid.
function datetimeLocalToEpochMs(value: string): string | null {
    if (!value) {
        return null;
    }
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) {
        return null;
    }
    return String(ms);
}

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
