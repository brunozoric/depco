import type React from "react";
import { Badge, Group, Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

interface PackageNameProps {
    pkg: IPackageListItemViewModel;
}

export function PackageName({ pkg }: PackageNameProps): React.ReactNode {
    return (
        <Table.Td>
            <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500}>
                    {pkg.name}
                </Text>
                <Text size="xs" c="dimmed">
                    ({pkg.projects.length})
                </Text>
                {pkg.registryResolved === false && (
                    <Badge color="yellow" size="xs" variant="light">
                        Pending
                    </Badge>
                )}
            </Group>
        </Table.Td>
    );
}
