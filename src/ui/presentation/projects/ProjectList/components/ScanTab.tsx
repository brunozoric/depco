import type React from "react";
import { useCallback, useState } from "react";
import { Button, Checkbox, Group, NumberInput, ScrollArea, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { FolderBrowser } from "./FolderBrowser.js";

interface ScanTabProps {
    presenter: ProjectListPresenter.Interface;
}

export const ScanTab = observer(function ScanTab({ presenter }: ScanTabProps): React.ReactNode {
    const { vm } = presenter;
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const handleToggle = useCallback((path: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        setSelected(new Set(vm.scanResults.map(item => item.path)));
    }, [vm.scanResults]);

    const handleDeselectAll = useCallback(() => {
        setSelected(new Set());
    }, []);

    const handleAddSelected = useCallback(async () => {
        await presenter.addProjects(Array.from(selected));
        if (!vm.addProjectError) {
            setSelected(new Set());
            presenter.clearScan();
        }
    }, [selected, presenter, vm.addProjectError]);

    const handleBack = useCallback(() => {
        setSelected(new Set());
        presenter.clearScan();
    }, [presenter]);

    if (vm.scanSummary) {
        return (
            <Stack gap="sm">
                <Text size="sm" c="dimmed">
                    {vm.scanSummary.mode === "workspaces"
                        ? `Resolved ${vm.scanSummary.filteredCount} new project${vm.scanSummary.filteredCount !== 1 ? "s" : ""} from workspaces in ${vm.scanSummary.scannedPath}`
                        : `Found ${vm.scanSummary.filteredCount} new project${vm.scanSummary.filteredCount !== 1 ? "s" : ""} in ${vm.scanSummary.scannedPath} (scanned ${vm.scanSummary.scannedCount} directories to depth ${vm.scanDepth})`}
                </Text>

                {vm.scanResults.length === 0 ? (
                    <Text size="sm" c="dimmed">
                        No new projects found. All projects in this directory are already added.
                    </Text>
                ) : (
                    <>
                        <Group gap="xs">
                            <Button size="xs" variant="subtle" onClick={handleSelectAll}>
                                Select All
                            </Button>
                            <Button size="xs" variant="subtle" onClick={handleDeselectAll}>
                                Deselect All
                            </Button>
                        </Group>

                        <ScrollArea h={250}>
                            <Stack gap={2}>
                                {vm.scanResults.map(item => (
                                    <Group key={item.path} gap="xs" p="xs">
                                        <Checkbox
                                            size="xs"
                                            checked={selected.has(item.path)}
                                            onChange={() => handleToggle(item.path)}
                                        />
                                        <Stack gap={0}>
                                            <Text size="sm" fw={500}>
                                                {item.name}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                {item.path}
                                            </Text>
                                        </Stack>
                                    </Group>
                                ))}
                            </Stack>
                        </ScrollArea>
                    </>
                )}

                {vm.addProjectError && (
                    <Text size="sm" c="red">
                        {vm.addProjectError}
                    </Text>
                )}

                <Group justify="space-between">
                    <Button variant="subtle" onClick={handleBack}>
                        Back
                    </Button>
                    {vm.scanResults.length > 0 && (
                        <Button
                            onClick={handleAddSelected}
                            loading={vm.addProjectLoading}
                            disabled={selected.size === 0}
                        >
                            Add Selected ({selected.size})
                        </Button>
                    )}
                </Group>
            </Stack>
        );
    }

    return (
        <Stack gap="sm">
            <Text size="sm" c="dimmed">
                Browse to a directory and scan for projects containing package.json.
            </Text>
            <FolderBrowser
                currentPath={vm.browsePath}
                items={vm.browseItems}
                onNavigate={path => presenter.browseTo(path)}
                loading={vm.browseLoading}
            />
            <Group justify="space-between" align="flex-end">
                <NumberInput
                    label="Scan depth"
                    description="How many directory levels to search"
                    value={vm.scanDepth}
                    onChange={value => typeof value === "number" && presenter.setScanDepth(value)}
                    min={1}
                    max={5}
                    step={1}
                    w={120}
                />
                <Button
                    onClick={() => presenter.scanDirectory()}
                    loading={vm.scanLoading}
                    disabled={!vm.browsePath}
                >
                    Scan
                </Button>
            </Group>
        </Stack>
    );
});
