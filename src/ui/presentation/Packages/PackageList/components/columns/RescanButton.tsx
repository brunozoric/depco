import type React from "react";
import { Button, Table } from "@mantine/core";

interface RescanButtonProps {
    packageName: string;
    onRescan: (packageName: string) => void;
}

export function RescanButton({ packageName, onRescan }: RescanButtonProps): React.ReactNode {
    return (
        <Table.Td>
            <Button
                size="xs"
                variant="light"
                onClick={event => {
                    event.stopPropagation();
                    onRescan(packageName);
                }}
            >
                Rescan
            </Button>
        </Table.Td>
    );
}
