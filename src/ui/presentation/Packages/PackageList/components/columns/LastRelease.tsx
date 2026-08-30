import type React from "react";
import { Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";
import { formatDate } from "#ui/infrastructure/Shared/formatting/dateFormatters.js";

interface LastReleaseProps {
    pkg: IPackageListItemViewModel;
}

export function LastRelease({ pkg }: LastReleaseProps): React.ReactNode {
    return (
        <Table.Td>
            <Text size="sm">{formatDate(pkg.lastPublishedAt, "-")}</Text>
        </Table.Td>
    );
}
