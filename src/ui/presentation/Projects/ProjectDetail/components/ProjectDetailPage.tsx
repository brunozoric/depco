import type React from "react";
import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Center,
    Group,
    Loader,
    MultiSelect,
    Pagination,
    Progress,
    SegmentedControl,
    Stack,
    Text,
    TextInput
} from "@mantine/core";
import type { UpgradeFilter } from "../abstractions/ProjectDetailPresenter.js";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { JobProgressFeature } from "../../../Jobs/JobProgress/feature.js";
import { JobProgressPanel } from "../../../Jobs/JobProgress/components/JobProgressPanel.js";
import { SecurityPanel } from "./SecurityPanel.js";
import { DependencyTable } from "./DependencyTable.js";
import { InstallDialog } from "./InstallDialog.js";
import { ChangelogModal } from "./ChangelogModal.js";
import { ScanScheduleSection } from "./ScanScheduleSection.js";
import { AutoFixSection } from "./AutoFixSection.js";
import { EngineStatusSection } from "./EngineStatusSection.js";
import { ProjectDetailHeader } from "./ProjectDetailHeader.js";
import { ProjectActionButtons } from "./ProjectActionButtons.js";

interface ProjectDetailPageProps {
    presenter: ProjectDetailPresenter.Interface;
    projectId: string;
}

interface ChangelogTarget {
    name: string;
    currentVersion: string;
    latestVersion: string;
}

export const ProjectDetailPage = observer(function ProjectDetailPage({
    presenter,
    projectId
}: ProjectDetailPageProps): React.ReactNode {
    const { presenter: jobProgressPresenter } = useFeature(JobProgressFeature);
    const { vm } = presenter;
    const [installDialogOpened, setInstallDialogOpened] = useState(false);
    const [changelogTarget, setChangelogTarget] = useState<ChangelogTarget | null>(null);

    useEffect(() => {
        presenter.load(projectId);
    }, [presenter, projectId]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    useEffect(() => {
        jobProgressPresenter.loadHistory(projectId);
    }, [jobProgressPresenter, projectId]);

    if (vm.loading && !vm.project) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    if (!vm.project) {
        return null;
    }

    const { project } = vm;
    const securityBlocked = vm.security !== null && !vm.security.passes;

    return (
        <Stack gap="md">
            <ProjectDetailHeader
                projectName={project.name}
                projectPath={project.path}
                packageManager={project.packageManager}
                packageManagerVersion={project.pmVersion}
                loading={vm.loading}
                scanning={vm.scanning}
                onBack={() => navigate("/")}
                onRefresh={() => presenter.load(projectId)}
                onRename={async name => presenter.renameProject(name)}
            />

            <MultiSelect
                label="Teams"
                placeholder="Assign teams"
                value={vm.projectTeamIds}
                onChange={teamIds => void presenter.setProjectTeams(teamIds)}
                data={vm.availableTeams.map(team => ({
                    value: team.id,
                    label: team.name
                }))}
            />

            <SecurityPanel security={vm.security} />

            {vm.scanError && (
                <Alert color="red" title="Scan failed">
                    {vm.scanError}
                </Alert>
            )}

            {vm.scanWarning && (
                <Alert color="orange" title="Scan Warning">
                    {vm.scanWarning}
                </Alert>
            )}

            {vm.sbomExportError && (
                <Alert color="red" title="SBOM export failed">
                    {vm.sbomExportError}
                </Alert>
            )}

            {vm.scanning ? (
                <Stack gap={4} py="xl" align="center">
                    <Group gap="sm">
                        <Loader size="sm" />
                        <Text size="sm" c="dimmed">
                            {vm.scanProgress
                                ? `Scanning: ${vm.scanProgress.packageName} (${vm.scanProgress.current}/${vm.scanProgress.total})`
                                : "Scanning dependencies..."}
                        </Text>
                    </Group>
                    {vm.scanProgress && (
                        <Progress
                            w="100%"
                            maw={400}
                            value={
                                vm.scanProgress.total > 0
                                    ? (vm.scanProgress.current / vm.scanProgress.total) * 100
                                    : 0
                            }
                        />
                    )}
                </Stack>
            ) : (
                <>
                    <Group gap="sm">
                        <TextInput
                            placeholder="Search packages..."
                            value={vm.search}
                            onChange={event => presenter.setSearch(event.currentTarget.value)}
                            style={{ flex: 1, maxWidth: 300 }}
                        />
                        <SegmentedControl
                            value={vm.upgradeFilter}
                            onChange={value => presenter.setUpgradeFilter(value as UpgradeFilter)}
                            data={[
                                { label: "All", value: "all" },
                                { label: "Upgradeable", value: "upgradeable" },
                                { label: "Up to date", value: "up-to-date" }
                            ]}
                        />
                        <Text size="sm" c="dimmed">
                            {vm.totalDependencyCount} packages
                        </Text>
                    </Group>
                    {vm.totalPages > 1 && (
                        <Group justify="center">
                            <Pagination
                                total={vm.totalPages}
                                value={vm.page}
                                onChange={presenter.setPage}
                            />
                        </Group>
                    )}
                    <DependencyTable
                        dependencies={vm.dependencies}
                        onToggle={presenter.togglePackage}
                        onSelectAll={presenter.selectAll}
                        onDeselectAll={presenter.deselectAll}
                        onViewChangelog={(name, currentVersion, latestVersion) =>
                            setChangelogTarget({ name, currentVersion, latestVersion })
                        }
                    />
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

            <ProjectActionButtons
                scanning={vm.scanning}
                selectedCount={vm.selectedCount}
                canUpgrade={vm.canUpgrade}
                securityBlocked={securityBlocked}
                hasPackageManager={!!vm.project?.packageManager}
                exportingSbom={vm.exportingSbom}
                onScan={() => presenter.scan()}
                onUpgradeSelected={() => {
                    const selected = vm.dependencies.filter(d => d.selected).map(d => d.name);
                    navigate(`/projects/${projectId}/upgrade?selected=${selected.join(",")}`);
                }}
                onRefreshTransient={() => presenter.refreshTransient()}
                onInstall={() => setInstallDialogOpened(true)}
                onStepHooks={() => navigate(`/projects/${projectId}/step-hooks`)}
                onDependencyGraph={() => navigate(`/projects/${projectId}/graph`)}
                onExportSbom={format => void presenter.exportSbom(format)}
            />

            <ScanScheduleSection presenter={presenter} />

            <Group align="flex-end">
                <TextInput
                    label="Package Manager version"
                    value={vm.packageManagerUpdateVersion}
                    onChange={event =>
                        presenter.setPackageManagerUpdateVersion(event.currentTarget.value)
                    }
                />
                <Button variant="light" onClick={() => presenter.updatePackageManager()}>
                    Update Package Manager
                </Button>
            </Group>

            <EngineStatusSection presenter={presenter} />

            <AutoFixSection presenter={presenter} />

            <JobProgressPanel presenter={jobProgressPresenter} />

            <InstallDialog
                opened={installDialogOpened}
                onClose={() => setInstallDialogOpened(false)}
                project={project}
                getInstallOptions={presenter.getInstallOptions}
                onInstall={flags => presenter.install(flags)}
            />

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
        </Stack>
    );
});
