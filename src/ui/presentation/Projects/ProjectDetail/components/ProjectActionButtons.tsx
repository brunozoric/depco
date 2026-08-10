import type React from "react";
import { Button, Group, Menu } from "@mantine/core";

interface ProjectActionButtonsProps {
    scanning: boolean;
    selectedCount: number;
    canUpgrade: boolean;
    securityBlocked: boolean;
    hasPackageManager: boolean;
    exportingSbom: boolean;
    onScan: () => void;
    onUpgradeSelected: () => void;
    onRefreshTransient: () => void;
    onInstall: () => void;
    onStepHooks: () => void;
    onDependencyGraph: () => void;
    onExportSbom: (format: string) => void;
}

export function ProjectActionButtons({
    scanning,
    selectedCount,
    canUpgrade,
    securityBlocked,
    hasPackageManager,
    exportingSbom,
    onScan,
    onUpgradeSelected,
    onRefreshTransient,
    onInstall,
    onStepHooks,
    onDependencyGraph,
    onExportSbom
}: ProjectActionButtonsProps): React.ReactNode {
    return (
        <Group>
            <Button onClick={onScan} loading={scanning}>
                Scan
            </Button>
            <Button onClick={onUpgradeSelected} disabled={!canUpgrade || securityBlocked}>
                Upgrade Selected ({selectedCount})
            </Button>
            <Button variant="light" onClick={onRefreshTransient}>
                Refresh Transient
            </Button>
            <Button variant="light" onClick={onInstall} disabled={!hasPackageManager}>
                Install
            </Button>
            <Button variant="light" onClick={onStepHooks}>
                Step Hooks
            </Button>
            <Button variant="light" onClick={onDependencyGraph}>
                Dependency Graph
            </Button>
            <Menu>
                <Menu.Target>
                    <Button variant="light" loading={exportingSbom}>
                        Export SBOM
                    </Button>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item onClick={() => onExportSbom("cyclonedx")}>CycloneDX</Menu.Item>
                    <Menu.Item onClick={() => onExportSbom("spdx")}>SPDX</Menu.Item>
                </Menu.Dropdown>
            </Menu>
        </Group>
    );
}
