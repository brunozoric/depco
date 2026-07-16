import type React from "react";
import { Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

function formatDate(timestamp: number | null): string {
    if (timestamp === null) {
        return "-";
    }
    return new Date(timestamp).toLocaleDateString();
}

interface ILastReleaseProps {
    pkg: IPackageListItemViewModel;
}

export function LastRelease({ pkg }: ILastReleaseProps): React.ReactNode {
    return (
        <Table.Td>
            <Text size="sm">{formatDate(pkg.lastPublishedAt)}</Text>
        </Table.Td>
    );
}
