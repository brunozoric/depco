import type React from "react";
import { Badge, Table } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

const UPGRADE_BADGE_COLOR: Record<string, string> = {
    patch: "green",
    minor: "yellow",
    major: "red",
    none: "gray"
};

interface UpgradeTypeProps {
    pkg: IPackageListItemViewModel;
}

export function UpgradeType({ pkg }: UpgradeTypeProps): React.ReactNode {
    return (
        <Table.Td>
            {pkg.highestUpgradeType !== "none" && (
                <Badge size="sm" color={UPGRADE_BADGE_COLOR[pkg.highestUpgradeType] ?? "gray"}>
                    {pkg.highestUpgradeType}
                </Badge>
            )}
        </Table.Td>
    );
}
