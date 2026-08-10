import type React from "react";
import { Badge, Table } from "@mantine/core";
import type { LicensesPresenter } from "../abstractions/LicensesPresenter.js";
import { RISK_TIER_COLORS } from "#ui/infrastructure/Shared/licenses/riskTierColors.js";
import { SortableHeader } from "#ui/infrastructure/Shared/components/SortableHeader.js";

const VIOLATION_COLORS: Record<string, string> = {
    warn: "yellow",
    deny: "red"
};

interface LicensesTableProps {
    licenses: LicensesPresenter.LicenseRow[];
    sortBy: string;
    sortOrder: string;
    onSort: (field: string) => void;
}

export function LicensesTable({
    licenses,
    sortBy,
    sortOrder,
    onSort
}: LicensesTableProps): React.ReactNode {
    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>
                        <SortableHeader
                            label="Package"
                            sortKey="packageName"
                            currentSortBy={sortBy}
                            currentSortOrder={sortOrder}
                            onSort={onSort}
                        />
                    </Table.Th>
                    <Table.Th>
                        <SortableHeader
                            label="License"
                            sortKey="licenseName"
                            currentSortBy={sortBy}
                            currentSortOrder={sortOrder}
                            onSort={onSort}
                        />
                    </Table.Th>
                    <Table.Th>SPDX</Table.Th>
                    <Table.Th>
                        <SortableHeader
                            label="Risk Tier"
                            sortKey="riskTier"
                            currentSortBy={sortBy}
                            currentSortOrder={sortOrder}
                            onSort={onSort}
                        />
                    </Table.Th>
                    <Table.Th>
                        <SortableHeader
                            label="Project"
                            sortKey="projectName"
                            currentSortBy={sortBy}
                            currentSortOrder={sortOrder}
                            onSort={onSort}
                        />
                    </Table.Th>
                    <Table.Th>Violation</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {licenses.map(license => (
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
                                <Badge color={VIOLATION_COLORS[license.violationAction] ?? "gray"}>
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
    );
}
