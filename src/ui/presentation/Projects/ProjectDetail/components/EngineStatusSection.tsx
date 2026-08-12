import type React from "react";
import { observer } from "mobx-react-lite";
import { Accordion, Badge, Group, Stack, Switch, Table, Text } from "@mantine/core";
import { EngineStatusBadge } from "#ui/infrastructure/Shared/engines/EngineStatusBadge.js";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import type { EngineScanStaleReason } from "../abstractions/ProjectDetailPresenter.js";

interface EngineStatusSectionProps {
    presenter: ProjectDetailPresenter.Interface;
}

function formatEolDate(eolDate: number | null): string | null {
    if (eolDate === null) {
        return null;
    }
    return new Date(eolDate).toLocaleDateString();
}

function formatRelativeTime(timestamp: number): string {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) {
        return "today";
    }
    if (days === 1) {
        return "1 day ago";
    }
    return `${days} days ago`;
}

function formatStaleReason(reason: EngineScanStaleReason): string {
    if (reason === "time") {
        return "Scan older than 7 days";
    }
    if (reason === "release") {
        return "New Node release since last scan";
    }
    return "Scan older than 7 days + new Node release";
}

export const EngineStatusSection = observer(function EngineStatusSection({
    presenter
}: EngineStatusSectionProps): React.ReactNode {
    const { vm } = presenter;
    const engineData = vm.engineData;
    const visibleFindings = engineData
        ? engineData.findings.filter(
              finding => vm.showMaintenance || finding.status !== "maintenance"
          )
        : [];

    return (
        <Accordion>
            <Accordion.Item value="engines">
                <Accordion.Control>Node.js Engine Compatibility</Accordion.Control>
                <Accordion.Panel>
                    {!engineData ? (
                        <Text size="sm" c="dimmed">
                            No engine scan data available. Run a scan to check Node.js
                            compatibility.
                        </Text>
                    ) : (
                        <Stack gap="md">
                            <Group gap="sm" justify="space-between">
                                <Group gap="sm">
                                    <EngineStatusBadge status={engineData.rootStatus} />
                                    <Text size="sm">
                                        engines.node:{" "}
                                        {engineData.rootEnginesNode ?? "not specified"}
                                    </Text>
                                    {engineData.rootEolDate !== null && (
                                        <Badge color="red" variant="light">
                                            EOL {formatEolDate(engineData.rootEolDate)}
                                        </Badge>
                                    )}
                                </Group>
                                <Switch
                                    size="sm"
                                    label="Show maintenance"
                                    checked={vm.showMaintenance}
                                    onChange={() => presenter.toggleMaintenance()}
                                />
                            </Group>

                            {engineData.lastScannedAt !== null && (
                                <Text
                                    size="sm"
                                    c={engineData.engineScanStale ? "orange" : "dimmed"}
                                >
                                    Last scanned {formatRelativeTime(engineData.lastScannedAt)}
                                    {engineData.engineScanStale &&
                                        engineData.engineScanStaleReason && (
                                            <>
                                                {" "}
                                                —{" "}
                                                {formatStaleReason(
                                                    engineData.engineScanStaleReason
                                                )}
                                            </>
                                        )}
                                </Text>
                            )}

                            {visibleFindings.length === 0 ? (
                                <Text size="sm" c="dimmed">
                                    No dependency-level engine findings.
                                </Text>
                            ) : (
                                <Table striped highlightOnHover>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Package</Table.Th>
                                            <Table.Th>engines.node</Table.Th>
                                            <Table.Th>Status</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {visibleFindings.map(finding => (
                                            <Table.Tr key={finding.packageName}>
                                                <Table.Td>{finding.packageName}</Table.Td>
                                                <Table.Td>{finding.enginesNode ?? "—"}</Table.Td>
                                                <Table.Td>
                                                    <EngineStatusBadge status={finding.status} />
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            )}
                        </Stack>
                    )}
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
});
