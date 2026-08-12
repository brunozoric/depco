import type React from "react";
import { Anchor, Badge, Group, Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";
import { navigate } from "#ui/infrastructure/Router/router.js";

interface PackageNameProps {
    pkg: IPackageListItemViewModel;
}

export function PackageName({ pkg }: PackageNameProps): React.ReactNode {
    const handlePackageClick = (event: React.MouseEvent): void => {
        event.stopPropagation();
        navigate(`/packages/${pkg.name}`);
    };

    return (
        <Table.Td>
            <Group gap="xs" wrap="nowrap">
                <Anchor
                    size="sm"
                    fw={500}
                    component="button"
                    variant="subtle"
                    onClick={handlePackageClick}
                >
                    {pkg.name}
                </Anchor>
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
