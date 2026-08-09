import type React from "react";
import { useState } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    FileInput,
    Group,
    Stack,
    Table,
    Text,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { BackupPresenter } from "../abstractions/BackupPresenter.js";
import type { BackupGateway } from "../../../../features/Backup/abstractions/BackupGateway.js";

interface BackupPageProps {
    presenter: BackupPresenter.Interface;
}

interface ImportResultRow {
    label: string;
    imported: number;
    skipped: number;
    failed: number | null;
}

function toRows(result: BackupGateway.ImportResult): ImportResultRow[] {
    return [
        {
            label: "App Settings",
            imported: result.appSettings.imported,
            skipped: result.appSettings.skipped,
            failed: null
        },
        {
            label: "Security Settings",
            imported: result.securitySettings.imported,
            skipped: result.securitySettings.skipped,
            failed: null
        },
        {
            label: "Projects",
            imported: result.projects.imported,
            skipped: result.projects.skipped,
            failed: result.projects.failed
        },
        {
            label: "Dependencies",
            imported: result.dependencies.imported,
            skipped: result.dependencies.skipped,
            failed: null
        },
        {
            label: "Registry Cache",
            imported: result.registryCache.imported,
            skipped: result.registryCache.skipped,
            failed: null
        }
    ];
}

export const BackupPage = observer(function BackupPage({
    presenter
}: BackupPageProps): React.ReactNode {
    const { vm } = presenter;
    const [file, setFile] = useState<File | null>(null);

    return (
        <Stack gap="md">
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>Backup</Title>
            </Group>

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            <Stack gap="xs">
                <Title order={4}>Export</Title>
                <Text size="sm" c="dimmed">
                    Download a compressed backup of app settings, security settings, projects,
                    dependencies, and cached registry data.
                </Text>
                <Group>
                    <Button loading={vm.loading} onClick={() => presenter.exportBackup()}>
                        Download Backup
                    </Button>
                </Group>
            </Stack>

            <Stack gap="xs">
                <Title order={4}>Import</Title>
                <Text size="sm" c="dimmed">
                    Restore data from a previously exported backup file.
                </Text>
                <Group>
                    <FileInput
                        placeholder="Select backup file"
                        accept=".zip"
                        value={file}
                        onChange={setFile}
                        clearable
                        style={{ width: 300 }}
                    />
                    <Button
                        loading={vm.loading}
                        disabled={!file}
                        onClick={() => {
                            if (file) {
                                presenter.importBackup(file);
                            }
                        }}
                    >
                        Import
                    </Button>
                </Group>
            </Stack>

            {vm.importResult && (
                <Stack gap="xs">
                    <Group justify="space-between">
                        <Title order={4}>Import Results</Title>
                        <Button size="xs" variant="subtle" onClick={() => presenter.clearResult()}>
                            Dismiss
                        </Button>
                    </Group>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Section</Table.Th>
                                <Table.Th>Imported</Table.Th>
                                <Table.Th>Skipped</Table.Th>
                                <Table.Th>Failed</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {toRows(vm.importResult).map(row => (
                                <Table.Tr key={row.label}>
                                    <Table.Td>{row.label}</Table.Td>
                                    <Table.Td>{row.imported}</Table.Td>
                                    <Table.Td>{row.skipped}</Table.Td>
                                    <Table.Td>{row.failed ?? "-"}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                    {vm.importResult.projects.errors.length > 0 && (
                        <Alert color="orange" title="Project import errors">
                            <Stack gap={4}>
                                {vm.importResult.projects.errors.map((message, index) => (
                                    <Text size="sm" key={index}>
                                        {message}
                                    </Text>
                                ))}
                            </Stack>
                        </Alert>
                    )}
                </Stack>
            )}
        </Stack>
    );
});
