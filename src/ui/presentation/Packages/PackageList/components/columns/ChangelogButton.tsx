import type React from "react";
import { Button, Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

interface ChangelogButtonProps {
    pkg: IPackageListItemViewModel;
    onOpenChangelog: (pkg: IPackageListItemViewModel) => void;
}

export function ChangelogButton({ pkg, onOpenChangelog }: ChangelogButtonProps): React.ReactNode {
    const resolved = pkg.resolvedChangelogCount;
    const pending = pkg.totalChangelogCount - resolved;
    const hasAny = pkg.totalChangelogCount > 0;

    return (
        <Table.Td>
            {pkg.highestUpgradeType !== "none" && hasAny && (
                <Button
                    size="xs"
                    variant="subtle"
                    onClick={event => {
                        event.stopPropagation();
                        onOpenChangelog(pkg);
                    }}
                >
                    Changelog
                    {resolved > 0 && pending > 0 && (
                        <>
                            {` (${resolved}`}
                            <Text component="span" size="xs" c="dimmed">
                                {`+${pending}`}
                            </Text>
                            {")"}
                        </>
                    )}
                    {resolved > 0 && pending === 0 && ` (${resolved})`}
                    {resolved === 0 && pending > 0 && (
                        <Text component="span" size="xs" c="dimmed">
                            {` (+${pending})`}
                        </Text>
                    )}
                </Button>
            )}
        </Table.Td>
    );
}
