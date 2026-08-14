import type React from "react";
import { Group, Table, Text, UnstyledButton } from "@mantine/core";

interface ISortableColumnHeaderProps {
    label: string;
    column: string;
    activeSortBy: string | null;
    activeSortOrder: string | null;
    onSort: (column: string | null) => void;
}

function getSortIndicator(
    column: string,
    activeSortBy: string | null,
    activeSortOrder: string | null
): string {
    if (activeSortBy !== column) {
        return "";
    }
    return activeSortOrder === "desc" ? " ▼" : " ▲";
}

export function SortableColumnHeader({
    label,
    column,
    activeSortBy,
    activeSortOrder,
    onSort
}: ISortableColumnHeaderProps): React.ReactNode {
    return (
        <Table.Th>
            <UnstyledButton onClick={() => onSort(column)}>
                <Group gap={4} wrap="nowrap">
                    <Text size="sm" fw={600}>
                        {label}
                    </Text>
                    <Text size="sm" c="dimmed">
                        {getSortIndicator(column, activeSortBy, activeSortOrder)}
                    </Text>
                </Group>
            </UnstyledButton>
        </Table.Th>
    );
}
