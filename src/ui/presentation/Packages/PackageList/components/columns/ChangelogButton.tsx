import type React from "react";
import { Button, Table } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

interface IChangelogButtonProps {
    pkg: IPackageListItemViewModel;
    onOpenChangelog: (pkg: IPackageListItemViewModel) => void;
}

export function ChangelogButton({ pkg, onOpenChangelog }: IChangelogButtonProps): React.ReactNode {
    return (
        <Table.Td>
            {pkg.highestUpgradeType !== "none" && (
                <Button
                    size="xs"
                    variant="subtle"
                    onClick={event => {
                        event.stopPropagation();
                        onOpenChangelog(pkg);
                    }}
                >
                    Changelog
                    {pkg.changelogCount > 0 && ` (${pkg.changelogCount})`}
                </Button>
            )}
        </Table.Td>
    );
}
