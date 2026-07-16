import type React from "react";
import { UnstyledButton, Text } from "@mantine/core";

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSortBy: string;
    currentSortOrder: string;
    onSort: (field: string) => void;
}

export function SortableHeader({
    label,
    sortKey,
    currentSortBy,
    currentSortOrder,
    onSort
}: SortableHeaderProps): React.ReactNode {
    const isActive = currentSortBy === sortKey;
    const arrow = isActive ? (currentSortOrder === "asc" ? " ▲" : " ▼") : "";

    return (
        <UnstyledButton onClick={() => onSort(sortKey)}>
            <Text fw={600} size="sm">
                {label}
                {arrow}
            </Text>
        </UnstyledButton>
    );
}
