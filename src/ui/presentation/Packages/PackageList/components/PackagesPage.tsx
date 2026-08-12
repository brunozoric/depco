import type React from "react";
import { Fragment, useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    Pagination,
    Stack,
    Table,
    Text,
    Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { SortableHeader } from "#ui/infrastructure/Shared/components/SortableHeader.js";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { PackagesPresenter } from "../abstractions/PackagesPresenter.js";
import { ChangelogModal } from "../../../Projects/ProjectDetail/components/ChangelogModal.js";
import { PackageName } from "./columns/PackageName.js";
import { UpgradeType } from "./columns/UpgradeType.js";
import { LastRelease } from "./columns/LastRelease.js";
import { ChangelogButton } from "./columns/ChangelogButton.js";
import { RescanButton } from "./columns/RescanButton.js";
import { ExpandedDependencies } from "./ExpandedDependencies.js";
import { PackageFilterToolbar } from "./PackageFilterToolbar.js";
import { ChangelogStatsBar } from "./ChangelogStatsBar.js";

interface PackagesPageProps {
    presenter: PackagesPresenter.Interface;
}

interface IChangelogTarget {
    name: string;
    currentVersion: string;
    latestVersion: string;
}

interface IUpgradeTarget {
    projectId: string;
    projectName: string;
    packageName: string;
    latestVersion: string;
}

function UpgradeDialog({
    target,
    onClose,
    onUpgrade
}: {
    target: IUpgradeTarget;
    onClose: () => void;
    onUpgrade: (projectId: string, packageName: string, targetVersion: string) => void;
}): React.ReactNode {
    return (
        <Modal opened={true} onClose={onClose} title={`Upgrade ${target.packageName}`} size="sm">
            <Stack gap="md">
                <Text size="sm">
                    Project:{" "}
                    <Text span fw={600}>
                        {target.projectName}
                    </Text>
                </Text>
                <Text size="sm" c="dimmed" ta="center" ff="monospace">
                    {target.packageName}@{target.latestVersion}
                </Text>
                <Button
                    fullWidth
                    onClick={() => {
                        onUpgrade(target.projectId, target.packageName, target.latestVersion);
                        onClose();
                    }}
                >
                    Upgrade
                </Button>
            </Stack>
        </Modal>
    );
}

export const PackagesPage = observer(function PackagesPage({
    presenter
}: PackagesPageProps): React.ReactNode {
    const { vm } = presenter;
    const [changelogTarget, setChangelogTarget] = useState<IChangelogTarget | null>(null);
    const [upgradeTarget, setUpgradeTarget] = useState<IUpgradeTarget | null>(null);
    const [dependencyPage, setDependencyPage] = useState<Record<string, number>>({});

    useEffect(() => {
        void presenter.load();
        return () => presenter.dispose();
    }, [presenter]);

    return (
        <Stack gap="md">
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>Packages</Title>
                {vm.totalCount > 0 && (
                    <Text size="sm" c="dimmed">
                        ({vm.totalCount})
                    </Text>
                )}
            </Group>

            <ChangelogStatsBar stats={vm.changelogStats} />

            <PackageFilterToolbar
                search={vm.search}
                upgradeType={vm.upgradeType}
                dependencyKind={vm.dependencyKind}
                projectId={vm.projectId}
                hasChangelog={vm.hasChangelog}
                projectOptions={vm.projectOptions}
                onSearchChange={presenter.setSearch}
                onUpgradeTypeChange={presenter.setUpgradeType}
                onDependencyKindChange={presenter.setDependencyKind}
                onProjectIdChange={presenter.setProjectId}
                onHasChangelogChange={presenter.setHasChangelog}
            />

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            {vm.loading && vm.packages.length === 0 ? (
                <Center py="xl">
                    <Loader />
                </Center>
            ) : vm.packages.length === 0 ? (
                <Text c="dimmed">No packages found</Text>
            ) : (
                <>
                    {vm.totalPages > 1 && (
                        <Group justify="center">
                            <Pagination
                                total={vm.totalPages}
                                value={vm.page}
                                onChange={presenter.setPage}
                            />
                        </Group>
                    )}
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>
                                    <SortableHeader
                                        label="Name"
                                        sortKey="name"
                                        currentSortBy={vm.sortBy}
                                        currentSortOrder={vm.sortOrder}
                                        onSort={presenter.setSortBy}
                                    />
                                </Table.Th>
                                <Table.Th>Upgrade</Table.Th>
                                <Table.Th>
                                    <SortableHeader
                                        label="Last Release"
                                        sortKey="lastPublishedAt"
                                        currentSortBy={vm.sortBy}
                                        currentSortOrder={vm.sortOrder}
                                        onSort={presenter.setSortBy}
                                    />
                                </Table.Th>
                                <Table.Th>Changelog</Table.Th>
                                <Table.Th></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {vm.packages.map(pkg => (
                                <Fragment key={pkg.name}>
                                    <Table.Tr
                                        onClick={() => presenter.togglePackageDetails(pkg.name)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <PackageName pkg={pkg} />
                                        <UpgradeType pkg={pkg} />
                                        <LastRelease pkg={pkg} />
                                        <ChangelogButton
                                            pkg={pkg}
                                            onOpenChangelog={p =>
                                                setChangelogTarget({
                                                    name: p.name,
                                                    currentVersion: p.minCurrentVersion,
                                                    latestVersion: p.maxLatestVersion
                                                })
                                            }
                                        />
                                        <RescanButton
                                            packageName={pkg.name}
                                            onRescan={name => void presenter.rescanPackage(name)}
                                        />
                                    </Table.Tr>
                                    {vm.expandedPackageName === pkg.name && (
                                        <ExpandedDependencies
                                            packageName={pkg.name}
                                            projects={pkg.projects}
                                            page={dependencyPage[pkg.name] ?? 1}
                                            onPageChange={page =>
                                                setDependencyPage(prev => ({
                                                    ...prev,
                                                    [pkg.name]: page
                                                }))
                                            }
                                            onUpgrade={setUpgradeTarget}
                                        />
                                    )}
                                </Fragment>
                            ))}
                        </Table.Tbody>
                    </Table>
                    {vm.totalPages > 1 && (
                        <Group justify="center">
                            <Pagination
                                total={vm.totalPages}
                                value={vm.page}
                                onChange={presenter.setPage}
                            />
                        </Group>
                    )}
                </>
            )}

            {changelogTarget && (
                <ChangelogModal
                    opened={true}
                    onClose={() => {
                        presenter.stopChangelogTracking();
                        setChangelogTarget(null);
                    }}
                    packageName={changelogTarget.name}
                    currentVersion={changelogTarget.currentVersion}
                    latestVersion={changelogTarget.latestVersion}
                    getChangelogs={presenter.getChangelogs}
                    onRefresh={presenter.reResolveChangelogs}
                    changelogState={vm.changelogState}
                    onStartTracking={presenter.startChangelogTracking}
                />
            )}

            {upgradeTarget && (
                <UpgradeDialog
                    target={upgradeTarget}
                    onClose={() => setUpgradeTarget(null)}
                    onUpgrade={(projectId, packageName, targetVersion) =>
                        void presenter.upgradePackage(projectId, packageName, targetVersion)
                    }
                />
            )}
        </Stack>
    );
});
