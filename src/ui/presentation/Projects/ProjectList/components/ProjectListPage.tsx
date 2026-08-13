import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Button,
    Center,
    Checkbox,
    Group,
    Loader,
    Menu,
    Stack,
    Table,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { AddProjectModal } from "./AddProjectModal.js";
import { ProjectRow } from "./ProjectRow.js";
import { InstallDialog } from "../../ProjectDetail/components/InstallDialog.js";

interface ProjectListPageProps {
    presenter: ProjectListPresenter.Interface;
}

export const ProjectListPage = observer(function ProjectListPage({
    presenter
}: ProjectListPageProps): React.ReactNode {
    const { vm } = presenter;
    const [addModalOpened, setAddModalOpened] = useState(false);
    const [installTarget, setInstallTarget] = useState<ProjectListPresenter.ProjectListItem | null>(
        null
    );
    const [bulkScanning, setBulkScanning] = useState(false);

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    const selectedCount = vm.selectedProjectIds.length;
    const allSelected =
        vm.projects.length > 0 &&
        vm.projects.every(project => vm.selectedProjectIds.includes(project.id));
    const someSelected = selectedCount > 0 && !allSelected;

    const handleBulkScan = async (): Promise<void> => {
        setBulkScanning(true);
        try {
            await presenter.bulkScanSelected();
        } finally {
            setBulkScanning(false);
        }
    };

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Group gap="sm">
                    <Title order={2}>Projects</Title>
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        onClick={() => presenter.load()}
                        loading={vm.loading}
                    >
                        &#x21bb;
                    </ActionIcon>
                    {vm.bulkActionRunning && (
                        <Group gap="xs">
                            <Loader size="xs" />
                            <Text size="sm" c="dimmed">
                                Running...
                            </Text>
                        </Group>
                    )}
                </Group>
                <Group gap="sm">
                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <Button
                                variant="light"
                                disabled={vm.projects.length === 0 || vm.bulkActionRunning}
                            >
                                Actions
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item onClick={() => presenter.scanAll()}>Scan All</Menu.Item>
                            <Menu.Item onClick={() => presenter.refreshAllSecurity()}>
                                Refresh All Security
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                    <Button
                        variant="light"
                        loading={vm.scanningAllEngines}
                        disabled={vm.projects.length === 0}
                        onClick={() => presenter.scanAllEngines()}
                    >
                        Check all engines
                    </Button>
                    <Button onClick={() => setAddModalOpened(true)}>Add Project</Button>
                </Group>
            </Group>
            <TextInput
                placeholder="Search projects..."
                value={vm.searchQuery}
                onChange={event => presenter.setSearchQuery(event.currentTarget.value)}
            />
            {selectedCount > 0 && (
                <Group bg="blue.0" p="xs" style={{ borderRadius: 4 }}>
                    <Text size="sm" fw={500}>
                        {selectedCount} selected
                    </Text>
                    <Button size="xs" loading={bulkScanning} onClick={handleBulkScan}>
                        Scan selected ({selectedCount})
                    </Button>
                    <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => presenter.deselectAllProjects()}
                    >
                        Clear
                    </Button>
                </Group>
            )}
            {vm.loading ? (
                <Center py="xl">
                    <Loader />
                </Center>
            ) : (
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: 40 }}>
                                <Checkbox
                                    aria-label="Select all projects"
                                    checked={allSelected}
                                    indeterminate={someSelected}
                                    onChange={() =>
                                        allSelected
                                            ? presenter.deselectAllProjects()
                                            : presenter.selectAllProjects()
                                    }
                                />
                            </Table.Th>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Path</Table.Th>
                            <Table.Th>Package Manager</Table.Th>
                            <Table.Th>Dependencies</Table.Th>
                            <Table.Th>Node.js</Table.Th>
                            <Table.Th>Security</Table.Th>
                            <Table.Th>Last Scanned</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {vm.projects.map(project => (
                            <ProjectRow
                                key={project.id}
                                project={project}
                                selected={vm.selectedProjectIds.includes(project.id)}
                                onToggleSelect={presenter.toggleProjectSelection}
                                onRemove={presenter.removeProject}
                                onInstall={setInstallTarget}
                                onScan={presenter.scanProject}
                            />
                        ))}
                    </Table.Tbody>
                </Table>
            )}
            <AddProjectModal
                presenter={presenter}
                opened={addModalOpened}
                onClose={() => setAddModalOpened(false)}
            />
            {installTarget && (
                <InstallDialog
                    opened={true}
                    onClose={() => setInstallTarget(null)}
                    project={installTarget}
                    getInstallOptions={presenter.getInstallOptions}
                    onInstall={flags => presenter.install(installTarget.id, flags)}
                />
            )}
        </Stack>
    );
});
