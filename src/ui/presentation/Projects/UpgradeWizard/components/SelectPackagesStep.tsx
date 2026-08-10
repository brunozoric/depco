import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useContainer } from "#ui/infrastructure/Shared/di/ContainerProvider.js";
import { ProjectsGateway } from "#ui/features/Projects/abstractions/ProjectsGateway.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";
import { SelectPackagesTable } from "./SelectPackagesTable.js";
import type { SelectPackagesRow } from "./SelectPackagesTable.js";
import { ChangelogDrawer } from "./ChangelogDrawer.js";
import type { ChangelogDrawerTarget } from "./ChangelogDrawer.js";

interface SelectPackagesStepProps {
    presenter: UpgradeWizardPresenter.Interface;
    projectId: string;
}

interface UpgradeableDependency extends ProjectsGateway.Dependency {
    upgradeType: "patch" | "minor" | "major";
}

function isUpgradeable(
    dependency: ProjectsGateway.Dependency
): dependency is UpgradeableDependency {
    return dependency.upgradeType !== "none";
}

function parsePreselectedNames(): Set<string> | null {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("selected");
    if (!raw) {
        return null;
    }

    const names = raw
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);
    return new Set(names);
}

export const SelectPackagesStep = observer(function SelectPackagesStep({
    presenter,
    projectId
}: SelectPackagesStepProps): React.ReactNode {
    const container = useContainer();
    const { vm } = presenter;

    const [depsLoading, setDepsLoading] = useState(true);
    const [dependencies, setDependencies] = useState<UpgradeableDependency[]>([]);
    const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
    const [targetVersions, setTargetVersions] = useState<Map<string, string>>(new Map());
    const [changelogTarget, setChangelogTarget] = useState<ChangelogDrawerTarget | null>(null);

    useEffect(() => {
        let cancelled = false;
        setDepsLoading(true);

        const projectsGateway = container.resolve(ProjectsGateway);
        void (async () => {
            try {
                const response = await projectsGateway.getDependencies(projectId);
                if (cancelled) {
                    return;
                }

                const upgradeable = response.dependencies.filter(isUpgradeable);
                const preselected = parsePreselectedNames();

                setDependencies(upgradeable);
                setSelectedNames(
                    preselected
                        ? new Set(
                              upgradeable
                                  .filter(dependency => preselected.has(dependency.name))
                                  .map(dependency => dependency.name)
                          )
                        : new Set()
                );
                setTargetVersions(
                    new Map(
                        upgradeable.map(dependency => [dependency.name, dependency.latestInRange])
                    )
                );
            } finally {
                if (!cancelled) {
                    setDepsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [container, projectId]);

    const rows: SelectPackagesRow[] = useMemo(
        () =>
            dependencies.map(dependency => ({
                name: dependency.name,
                currentVersion: dependency.currentVersion,
                latestInRange: dependency.latestInRange,
                latestVersion: dependency.latestVersion,
                type: dependency.type,
                upgradeType: dependency.upgradeType,
                selected: selectedNames.has(dependency.name),
                targetVersion: targetVersions.get(dependency.name) ?? dependency.latestInRange
            })),
        [dependencies, selectedNames, targetVersions]
    );

    const toggle = useCallback((name: string) => {
        setSelectedNames(previous => {
            const next = new Set(previous);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedNames(new Set(dependencies.map(dependency => dependency.name)));
    }, [dependencies]);

    const deselectAll = useCallback(() => {
        setSelectedNames(new Set());
    }, []);

    const setTargetVersion = useCallback((name: string, version: string) => {
        setTargetVersions(previous => new Map(previous).set(name, version));
    }, []);

    const viewChangelog = useCallback(
        (name: string, currentVersion: string, latestVersion: string) => {
            setChangelogTarget({ packageName: name, currentVersion, latestVersion });
        },
        []
    );

    const closeChangelog = useCallback(() => {
        setChangelogTarget(null);
    }, []);

    const handleContinue = useCallback(async () => {
        const packages = rows
            .filter(row => row.selected)
            .map(row => ({ name: row.name, targetVersion: row.targetVersion }));
        await presenter.executeStep("select-packages", { packages });
    }, [rows, presenter]);

    if (depsLoading) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    if (rows.length === 0) {
        return <Text c="dimmed">No upgradeable dependencies found for this project.</Text>;
    }

    const selectedCount = rows.filter(row => row.selected).length;

    return (
        <Stack gap="md">
            <SelectPackagesTable
                rows={rows}
                onToggle={toggle}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onSetTargetVersion={setTargetVersion}
                onViewChangelog={viewChangelog}
            />
            <Group justify="space-between">
                <Text size="sm" c="dimmed">
                    {selectedCount} of {rows.length} selected
                </Text>
                <Button
                    onClick={handleContinue}
                    loading={vm.loading}
                    disabled={selectedCount === 0}
                >
                    Continue
                </Button>
            </Group>
            <ChangelogDrawer
                target={changelogTarget}
                onClose={() => {
                    presenter.stopChangelogTracking();
                    closeChangelog();
                }}
                getChangelogs={presenter.getChangelogs}
                onRefresh={presenter.reResolveChangelogs}
                changelogState={vm.changelogState}
                onStartTracking={presenter.startChangelogTracking}
            />
        </Stack>
    );
});
