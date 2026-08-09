import type React from "react";
import { useState } from "react";
import { ActionIcon, Badge, Group, Menu, Stack, Table, Text, Tooltip } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";

interface ProjectRowProps {
    project: ProjectListPresenter.ProjectListItem;
    onRemove: (id: string) => Promise<void>;
    onInstall: (project: ProjectListPresenter.ProjectListItem) => void;
    onScan: (id: string) => Promise<void>;
}

function formatLastScanned(lastScannedAt: number | null): string {
    if (lastScannedAt === null) {
        return "Never";
    }
    return new Date(lastScannedAt).toLocaleString();
}

const ACRONYMS = new Set(["npm", "pnpm", "yarn"]);

function formatFieldName(key: string): string {
    const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ");
    return words
        .filter(word => word.length > 0)
        .map(word => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) {
                return lower.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

function SecurityTooltipContent({ checks }: { checks: Record<string, boolean> }): React.ReactNode {
    return (
        <Stack gap={4}>
            {Object.entries(checks).map(([key, passed]) => (
                <Group key={key} gap="xs" justify="space-between" wrap="nowrap">
                    <Text size="xs">{formatFieldName(key)}</Text>
                    <Text size="xs" c={passed ? "green" : "red"} fw={600}>
                        {passed ? "Pass" : "Fail"}
                    </Text>
                </Group>
            ))}
        </Stack>
    );
}

const SCAN_STATUS_COLOR: Record<ProjectListPresenter.ScanStatus, string> = {
    idle: "gray",
    scanning: "blue",
    done: "green",
    failed: "red"
};

const SCAN_STATUS_LABEL: Record<ProjectListPresenter.ScanStatus, string> = {
    idle: "Idle",
    scanning: "Scanning...",
    done: "Scanned",
    failed: "Scan failed"
};

export const ProjectRow = observer(function ProjectRow({
    project,
    onRemove,
    onInstall,
    onScan
}: ProjectRowProps): React.ReactNode {
    const [confirmRemove, setConfirmRemove] = useState(false);

    return (
        <Table.Tr>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    <Text
                        size="sm"
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => navigate(`/Projects/${project.id}`)}
                    >
                        {project.name}
                    </Text>
                    {project.teams.map(team => (
                        <Badge key={team.id} size="xs" variant="light" color={team.color}>
                            {team.name}
                        </Badge>
                    ))}
                </Group>
            </Table.Td>
            <Table.Td>{project.path}</Table.Td>
            <Table.Td>
                {project.packageManager
                    ? `${project.packageManager.charAt(0).toUpperCase()}${project.packageManager.slice(1)} ${project.pmVersion || "(not installed)"}`.trim()
                    : "Not detected"}
            </Table.Td>
            <Table.Td>
                <Badge size="sm" color={project.hasNodeModules ? "green" : "gray"}>
                    {project.hasNodeModules ? "Installed" : "Not Installed"}
                </Badge>
            </Table.Td>
            <Table.Td>
                {project.securityChecks ? (
                    <Tooltip
                        label={<SecurityTooltipContent checks={project.securityChecks} />}
                        multiline
                        w={280}
                        position="bottom"
                    >
                        <Badge
                            style={{ cursor: "default" }}
                            color={project.securityPasses ? "green" : "red"}
                        >
                            {project.securityPasses ? "Secure" : "Insecure"}
                        </Badge>
                    </Tooltip>
                ) : (
                    <Badge color="gray">Not checked</Badge>
                )}
            </Table.Td>
            <Table.Td>
                <Group gap="xs">
                    <Text size="sm">{formatLastScanned(project.lastScannedAt)}</Text>
                    {project.scanStatus !== "idle" && (
                        <Badge size="sm" color={SCAN_STATUS_COLOR[project.scanStatus]}>
                            {SCAN_STATUS_LABEL[project.scanStatus]}
                        </Badge>
                    )}
                </Group>
            </Table.Td>
            <Table.Td style={{ textAlign: "right" }}>
                <Menu shadow="md" width={160} position="bottom-end">
                    <Menu.Target>
                        <ActionIcon variant="light" size="md">
                            &#8943;
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => navigate(`/Projects/${project.id}`)}>
                            View
                        </Menu.Item>
                        <Menu.Item onClick={() => onScan(project.id)}>Scan</Menu.Item>
                        <Menu.Item
                            disabled={!project.packageManager}
                            onClick={() => onInstall(project)}
                        >
                            Install
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item color="red" onClick={() => setConfirmRemove(true)}>
                            Remove
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
                <ConfirmDialog
                    opened={confirmRemove}
                    title="Remove Project"
                    message={`Remove "${project.name}" from the project list? This does not delete any files on disk.`}
                    confirmLabel="Remove"
                    onConfirm={() => {
                        setConfirmRemove(false);
                        onRemove(project.id);
                    }}
                    onCancel={() => setConfirmRemove(false)}
                />
            </Table.Td>
        </Table.Tr>
    );
});
