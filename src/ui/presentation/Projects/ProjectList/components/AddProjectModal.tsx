import type React from "react";
import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { FolderBrowser } from "./FolderBrowser.js";
import { ScanTab } from "./ScanTab.js";

interface AddProjectModalProps {
    presenter: ProjectListPresenter.Interface;
    opened: boolean;
    onClose: () => void;
}

export const AddProjectModal = observer(function AddProjectModal({
    presenter,
    opened,
    onClose
}: AddProjectModalProps): React.ReactNode {
    const { vm } = presenter;
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (opened) {
            void presenter.browseTo("");
            presenter.clearScan();
            setSelected(new Set());
        }
    }, [opened, presenter]);

    const handleToggle = (path: string): void => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleAddSelected = async (): Promise<void> => {
        const paths = Array.from(selected);
        await presenter.addProjects(paths);
        setSelected(new Set());
        if (!vm.addProjectError) {
            onClose();
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Add Project" size="lg">
            <Tabs defaultValue="browse">
                <Tabs.List>
                    <Tabs.Tab value="browse">Browse</Tabs.Tab>
                    <Tabs.Tab value="manual">Manual Path</Tabs.Tab>
                    <Tabs.Tab value="clone">Clone from GitHub</Tabs.Tab>
                    <Tabs.Tab value="scan">Scan</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="browse" pt="sm">
                    <Stack gap="sm">
                        <Text size="sm" c="dimmed">
                            Navigate to a directory and select folders to add as projects.
                        </Text>
                        <FolderBrowser
                            currentPath={vm.browsePath}
                            items={vm.browseItems}
                            onNavigate={path => presenter.browseTo(path)}
                            loading={vm.browseLoading}
                            selected={selected}
                            onToggle={handleToggle}
                        />
                        {selected.size > 0 && (
                            <Text size="xs" c="dimmed">
                                {selected.size} folder{selected.size > 1 ? "s" : ""} selected
                            </Text>
                        )}
                        {vm.addProjectError && (
                            <Text size="sm" c="red">
                                {vm.addProjectError}
                            </Text>
                        )}
                        <Group justify="flex-end">
                            <Button
                                onClick={handleAddSelected}
                                loading={vm.addProjectLoading}
                                disabled={selected.size === 0}
                            >
                                Add {selected.size > 0 ? `(${selected.size})` : ""}
                            </Button>
                        </Group>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="manual" pt="sm">
                    <Stack gap="sm">
                        <TextInput
                            label="Project Path"
                            placeholder="/path/to/project"
                            value={vm.addProjectPath}
                            onChange={event =>
                                presenter.setAddProjectPath(event.currentTarget.value)
                            }
                            error={vm.addProjectError}
                            disabled={vm.addProjectLoading}
                        />
                        <Button
                            onClick={() => presenter.addProject()}
                            loading={vm.addProjectLoading}
                        >
                            Add
                        </Button>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="clone" pt="sm">
                    <Stack gap="sm">
                        <TextInput
                            label="Repository URL"
                            placeholder="https://github.com/org/repo"
                            value={vm.cloneUrl}
                            onChange={event => presenter.setCloneUrl(event.currentTarget.value)}
                            disabled={vm.cloneLoading}
                        />
                        <Text size="sm" fw={500}>
                            Clone Destination
                        </Text>
                        <FolderBrowser
                            currentPath={vm.browsePath}
                            items={vm.browseItems}
                            onNavigate={path => presenter.browseTo(path)}
                            loading={vm.browseLoading}
                        />
                        <TextInput
                            label="Folder Name"
                            value={vm.cloneFolderName}
                            onChange={event =>
                                presenter.setCloneFolderName(event.currentTarget.value)
                            }
                            disabled={vm.cloneLoading}
                        />
                        {vm.browsePath && vm.cloneFolderName && (
                            <Text size="xs" c="dimmed">
                                Will clone to: {vm.browsePath}/{vm.cloneFolderName}
                            </Text>
                        )}
                        {vm.cloneError && (
                            <Text size="sm" c="red">
                                {vm.cloneError}
                            </Text>
                        )}
                        <Button
                            onClick={() => presenter.cloneProject()}
                            loading={vm.cloneLoading}
                            disabled={!vm.cloneUrl || !vm.browsePath || !vm.cloneFolderName}
                        >
                            Clone
                        </Button>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="scan" pt="sm">
                    <ScanTab presenter={presenter} />
                </Tabs.Panel>
            </Tabs>
        </Modal>
    );
});
