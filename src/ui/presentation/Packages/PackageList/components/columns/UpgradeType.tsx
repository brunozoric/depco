import type React from "react";
import { Badge, Table } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";
import { UPGRADE_BADGE_COLORS } from "#ui/infrastructure/Shared/upgrades/upgradeBadgeColors.js";

interface UpgradeTypeProps {
    pkg: IPackageListItemViewModel;
}

export function UpgradeType({ pkg }: UpgradeTypeProps): React.ReactNode {
    return (
        <Table.Td>
            {pkg.highestUpgradeType !== "none" && (
                <Badge size="sm" color={UPGRADE_BADGE_COLORS[pkg.highestUpgradeType] ?? "gray"}>
                    {pkg.highestUpgradeType}
                </Badge>
            )}
        </Table.Td>
    );
}
