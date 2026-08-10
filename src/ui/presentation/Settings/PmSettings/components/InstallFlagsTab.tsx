import type React from "react";
import { Badge, Switch, Table, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface InstallFlagsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

export const InstallFlagsTab = observer(function InstallFlagsTab({
    presenter
}: InstallFlagsTabProps): React.ReactNode {
    const { vm } = presenter;

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Flag</Table.Th>
                    <Table.Th>Label</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Enabled</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Default</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Source</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {vm.installFlags.map(flag => (
                    <Table.Tr key={flag.flag}>
                        <Table.Td>
                            <Text size="sm" ff="monospace">
                                {flag.flag}
                            </Text>
                        </Table.Td>
                        <Table.Td>
                            <Text size="sm">{flag.label}</Text>
                        </Table.Td>
                        <Table.Td>
                            <Text size="sm" c="dimmed">
                                {flag.description}
                            </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            <Switch
                                checked={flag.enabled}
                                onChange={() => presenter.toggleInstallFlag(flag.flag)}
                                size="sm"
                                aria-label={`Toggle ${flag.label}`}
                            />
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            <Badge size="sm" variant="outline" color="gray">
                                {flag.defaultEnabled ? "Default on" : "Default off"}
                            </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            {flag.isFileManaged && (
                                <Badge size="sm" color="blue">
                                    File
                                </Badge>
                            )}
                        </Table.Td>
                    </Table.Tr>
                ))}
                {vm.installFlags.length === 0 && (
                    <Table.Tr>
                        <Table.Td colSpan={6}>
                            <Text size="sm" c="dimmed" ta="center" py="md">
                                No install flags available for {vm.selectedPackageManager}.
                            </Text>
                        </Table.Td>
                    </Table.Tr>
                )}
            </Table.Tbody>
        </Table>
    );
});
