import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    AppShell,
    Button,
    ColorSwatch,
    MantineProvider,
    Menu,
    Title,
    Group,
    Select
} from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import { observer } from "mobx-react-lite";
import type { AnyFeature } from "#shared/index.js";
import { createJobStatusNotificationHandler } from "./shared/notifications/jobNotifications.js";
import { showConfigErrorToast } from "./shared/notifications/configErrorNotification.js";
import { handleSnoozeExpired } from "./shared/notifications/snoozeNotifications.js";
import { ContainerProvider, useContainer } from "#ui/shared/di/ContainerProvider.js";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { navigate, useCurrentPath } from "#ui/shared/router/router.js";
import { AuthGateway } from "#ui/features/auth/abstractions/AuthGateway.js";
import { AuthRepository } from "#ui/features/auth/abstractions/AuthRepository.js";
import { AuthFeature } from "#ui/features/auth/feature.js";
import { LoginPageFeature } from "./presentation/auth/LoginPage/feature.js";
import { LoginPage } from "./presentation/auth/LoginPage/LoginPage.js";
import { PmSettingsGateway } from "#ui/features/settings/abstractions/PmSettingsGateway.js";
import { AppSettingsGateway } from "#ui/features/appSettings/abstractions/AppSettingsGateway.js";
import { HTTPClientFeature } from "#ui/httpClient/index.js";
import { ProjectsFeature } from "#ui/features/projects/index.js";
import { UpgradesFeature } from "#ui/features/upgrades/index.js";
import { PmSettingsFeature } from "#ui/features/settings/index.js";
import { WebSocketFeature, WebSocketListener } from "#ui/websocket/index.js";
import { EventBridge } from "#ui/events/abstractions/EventBridge.js";
import { EventBridgeFeature } from "#ui/events/index.js";
import "#ui/events/eventMap.js";
import { ProjectsUseCasesFeature } from "./presentation/projects/useCases/feature.js";
import { UpgradesUseCasesFeature } from "./presentation/upgrades/useCases/feature.js";
import { ProjectListFeature } from "./presentation/projects/ProjectList/feature.js";
import { ProjectListProvider } from "./presentation/projects/ProjectList/ProjectListProvider.js";
import { ProjectListPage } from "./presentation/projects/ProjectList/components/ProjectListPage.js";
import { ProjectDetailFeature } from "./presentation/projects/ProjectDetail/feature.js";
import { ProjectDetailProvider } from "./presentation/projects/ProjectDetail/ProjectDetailProvider.js";
import { ProjectDetailPage } from "./presentation/projects/ProjectDetail/components/ProjectDetailPage.js";
import { JobProgressFeature } from "./presentation/jobs/JobProgress/feature.js";
import { SecuritySettingsUseCasesFeature } from "./presentation/settings/useCases/feature.js";
import { PmSettingsPresentationFeature } from "./presentation/settings/PmSettings/feature.js";
import { PmSettingsProvider } from "./presentation/settings/PmSettings/PmSettingsProvider.js";
import { PmSettingsPage } from "./presentation/settings/PmSettings/components/PmSettingsPage.js";
import { JobsFeature } from "#ui/features/jobs/index.js";
import { JobManagerUseCasesFeature } from "./presentation/jobs/JobManager/useCases/feature.js";
import { JobManagerPresentationFeature } from "./presentation/jobs/JobManager/feature.js";
import { JobManagerProvider } from "./presentation/jobs/JobManager/JobManagerProvider.js";
import { JobManagerPage } from "./presentation/jobs/JobManager/components/JobManagerPage.js";
import { PackagesFeature } from "./features/packages/feature.js";
import { PackagesUseCasesFeature } from "./presentation/packages/useCases/feature.js";
import { PackageListFeature } from "./presentation/packages/PackageList/feature.js";
import { PackagesProvider } from "./presentation/packages/PackageList/PackagesProvider.js";
import { PackagesPage } from "./presentation/packages/PackageList/components/PackagesPage.js";
import { UpgradeWizardFeature } from "./presentation/projects/UpgradeWizard/feature.js";
import { UpgradeWizardProvider } from "./presentation/projects/UpgradeWizard/UpgradeWizardProvider.js";
import { UpgradeWizardPage } from "./presentation/projects/UpgradeWizard/components/UpgradeWizardPage.js";
import { AppSettingsFeature } from "./features/appSettings/feature.js";
import { AppSettingsUseCasesFeature } from "./presentation/settings/appSettingsUseCases/feature.js";
import { AppSettingsPresentationFeature } from "./presentation/settings/AppSettings/feature.js";
import { AppSettingsProvider } from "./presentation/settings/AppSettings/AppSettingsProvider.js";
import { AppSettingsPage } from "./presentation/settings/AppSettings/components/AppSettingsPage.js";
import { AppLogsFeature } from "./features/appLogs/feature.js";
import { AppLogsUseCasesFeature } from "./presentation/logs/useCases/feature.js";
import { LogBrowserPresentationFeature } from "./presentation/logs/LogBrowser/feature.js";
import { LogBrowserProvider } from "./presentation/logs/LogBrowser/LogBrowserProvider.js";
import { LogBrowserPage } from "./presentation/logs/LogBrowser/components/LogBrowserPage.js";
import { BackupFeature } from "./features/backup/feature.js";
import { BackupUseCasesFeature } from "./presentation/backup/useCases/feature.js";
import { BackupPresentationFeature } from "./presentation/backup/BackupPage/feature.js";
import { BackupProvider } from "./presentation/backup/BackupPage/BackupProvider.js";
import { BackupPage } from "./presentation/backup/BackupPage/components/BackupPage.js";
import { StepHooksFeature } from "./features/stepHooks/index.js";
import { StepHooksPresentationFeature } from "./presentation/projects/StepHooks/feature.js";
import { StepHooksProvider } from "./presentation/projects/StepHooks/StepHooksProvider.js";
import { StepHooksPage } from "./presentation/projects/StepHooks/components/StepHooksPage.js";
import { DashboardPresentationFeature } from "./presentation/dashboard/Dashboard/feature.js";
import { DashboardProvider } from "./presentation/dashboard/Dashboard/DashboardProvider.js";
import { DashboardPage } from "./presentation/dashboard/Dashboard/components/DashboardPage.js";
import { ScanSchedulesFeature } from "./features/scanSchedules/index.js";
import { ScanSchedulesUseCasesFeature } from "./presentation/scanSchedules/useCases/feature.js";
import { VulnerabilitiesFeature } from "./features/vulnerabilities/feature.js";
import { VulnerabilitiesUseCasesFeature } from "./presentation/vulnerabilities/useCases/feature.js";
import { VulnerabilityListFeature } from "./presentation/vulnerabilities/VulnerabilityList/feature.js";
import { VulnerabilitiesProvider } from "./presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesProvider.js";
import { VulnerabilitiesPage } from "./presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.js";
import { VulnerabilityDetailFeature } from "./presentation/vulnerabilities/VulnerabilityDetail/feature.js";
import { VulnerabilityDetailProvider } from "./presentation/vulnerabilities/VulnerabilityDetail/components/VulnerabilityDetailProvider.js";
import { VulnerabilityDetailPage } from "./presentation/vulnerabilities/VulnerabilityDetail/components/VulnerabilityDetailPage.js";
import { LicensesFeature } from "./features/licenses/feature.js";
import { LicensesUseCasesFeature } from "./presentation/licenses/useCases/feature.js";
import { LicenseListFeature } from "./presentation/licenses/LicensesList/feature.js";
import { LicensesProvider } from "./presentation/licenses/LicensesList/LicensesProvider.js";
import { LicensesPage } from "./presentation/licenses/LicensesList/components/LicensesPage.js";
import { AutoFixFeature } from "./features/autoFix/feature.js";
import { AutoFixUseCasesFeature } from "./presentation/autoFix/useCases/feature.js";
import { DependencyGraphFeature } from "./features/dependencyGraph/feature.js";
import { DependencyGraphUseCasesFeature } from "./presentation/dependencyGraph/useCases/feature.js";
import { DependencyGraphPageFeature } from "./presentation/dependencyGraph/GraphPage/feature.js";
import { DependencyGraphProvider } from "./presentation/dependencyGraph/GraphPage/DependencyGraphProvider.js";
import { DependencyGraphPage } from "./presentation/dependencyGraph/GraphPage/components/DependencyGraphPage.js";
import { SbomFeature } from "./features/sbom/feature.js";
import { SbomUseCasesFeature } from "./presentation/sbom/useCases/feature.js";
import { SbomPageFeature } from "./presentation/sbom/SbomPage/feature.js";
import { SbomExportDialog } from "./presentation/sbom/SbomPage/components/SbomExportDialog.js";
import { SbomPresenter } from "./presentation/sbom/SbomPage/abstractions/SbomPresenter.js";
import { TrendsFeature } from "./features/trends/feature.js";
import { TrendsUseCasesFeature } from "./presentation/trends/useCases/feature.js";
import { TrendsPageFeature } from "./presentation/trends/TrendsPage/feature.js";
import { TrendsProvider } from "./presentation/trends/TrendsPage/TrendsProvider.js";
import { TrendsPage } from "./presentation/trends/TrendsPage/components/TrendsPage.js";
import { TeamFilterFeature } from "#ui/features/teamFilter/feature.js";
import { TeamFilterService } from "#ui/features/teamFilter/abstractions/TeamFilterService.js";
import { TeamListService } from "#ui/features/teamFilter/abstractions/TeamListService.js";
import { TeamsFeature } from "./features/teams/feature.js";
import { TeamsUseCasesFeature } from "./presentation/teams/useCases/feature.js";
import { TeamsPageFeature } from "./presentation/teams/TeamsPage/feature.js";
import { TeamsProvider } from "./presentation/teams/TeamsPage/TeamsProvider.js";
import { TeamsPage } from "./presentation/teams/TeamsPage/components/TeamsPage.js";
import { TeamDetailFeature } from "./presentation/teams/TeamDetail/feature.js";
import { TeamDetailProvider } from "./presentation/teams/TeamDetail/TeamDetailProvider.js";
import { TeamDetailPage } from "./presentation/teams/TeamDetail/components/TeamDetailPage.js";
import { UsersFeature } from "./features/users/feature.js";
import { UsersUseCasesFeature } from "./presentation/users/useCases/feature.js";
import { UserListFeature } from "./presentation/users/UserList/feature.js";
import { UserListProvider } from "./presentation/users/UserList/UserListProvider.js";
import { UserListPage } from "./presentation/users/UserList/components/UserListPage.js";

const ALL_FEATURES: AnyFeature[] = [
    HTTPClientFeature,
    AuthFeature,
    LoginPageFeature,
    ProjectsFeature,
    UpgradesFeature,
    ProjectsUseCasesFeature,
    UpgradesUseCasesFeature,
    ProjectListFeature,
    ProjectDetailFeature,
    JobProgressFeature,
    PmSettingsFeature,
    SecuritySettingsUseCasesFeature,
    PmSettingsPresentationFeature,
    JobsFeature,
    JobManagerUseCasesFeature,
    JobManagerPresentationFeature,
    WebSocketFeature,
    EventBridgeFeature,
    PackagesFeature,
    PackagesUseCasesFeature,
    PackageListFeature,
    UpgradeWizardFeature,
    AppSettingsFeature,
    AppSettingsUseCasesFeature,
    AppSettingsPresentationFeature,
    AppLogsFeature,
    AppLogsUseCasesFeature,
    LogBrowserPresentationFeature,
    BackupFeature,
    BackupUseCasesFeature,
    BackupPresentationFeature,
    StepHooksFeature,
    StepHooksPresentationFeature,
    VulnerabilitiesFeature,
    VulnerabilitiesUseCasesFeature,
    VulnerabilityListFeature,
    VulnerabilityDetailFeature,
    DashboardPresentationFeature,
    ScanSchedulesFeature,
    ScanSchedulesUseCasesFeature,
    LicensesFeature,
    LicensesUseCasesFeature,
    LicenseListFeature,
    AutoFixFeature,
    AutoFixUseCasesFeature,
    DependencyGraphFeature,
    DependencyGraphUseCasesFeature,
    DependencyGraphPageFeature,
    SbomFeature,
    SbomUseCasesFeature,
    SbomPageFeature,
    TrendsFeature,
    TrendsUseCasesFeature,
    TrendsPageFeature,
    TeamFilterFeature,
    TeamsFeature,
    TeamsUseCasesFeature,
    TeamsPageFeature,
    TeamDetailFeature,
    UsersFeature,
    UsersUseCasesFeature,
    UserListFeature
];

const UPGRADE_WIZARD_PATH_PATTERN = /^\/projects\/([^/]+)\/upgrade$/;
const STEP_HOOKS_PATH_PATTERN = /^\/projects\/([^/]+)\/step-hooks$/;
const DEPENDENCY_GRAPH_PATH_PATTERN = /^\/projects\/([^/]+)\/graph$/;
const PROJECT_DETAIL_PATH_PATTERN = /^\/projects\/([^/]+)$/;
const VULNERABILITY_DETAIL_PATH_PATTERN = /^\/vulnerabilities\/([^/]+)$/;
const TEAM_DETAIL_PATH_PATTERN = /^\/teams\/([^/]+)$/;

// Establishes the WebSocket connection once on app mount and tears it down
// on unmount. Renders nothing — it only manages the connection lifecycle.
function WebSocketConnector(): null {
    const container = useContainer();

    useEffect(() => {
        const listener = container.resolve(WebSocketListener);
        listener.connect();
        return () => {
            listener.disconnect();
        };
    }, [container]);

    return null;
}

// Restores the session on app mount by validating the cached token against
// the server. Clears auth if the token is no longer valid. Renders nothing.
function SessionRestorer(): null {
    const container = useContainer();

    useEffect(() => {
        const authRepository = container.resolve(AuthRepository);
        const token = authRepository.token;
        if (!token) {
            return;
        }

        const authGateway = container.resolve(AuthGateway);
        authGateway
            .getMe()
            .then(user => {
                authRepository.setAuth({ token, user });
            })
            .catch(() => {
                authRepository.clearAuth();
            });
    }, [container]);

    return null;
}

// Checks the URL for a magic-link token/email pair on app mount, verifies it,
// and strips the params from the URL once handled. Renders nothing.
function MagicLinkHandler(): null {
    const container = useContainer();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        const email = params.get("email");
        if (!token || !email) {
            return;
        }

        const { presenter } = LoginPageFeature.resolve(container);
        void presenter.verifyMagicLink({ token, email });

        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        url.searchParams.delete("email");
        window.history.replaceState(null, "", url.toString());
    }, [container]);

    return null;
}

// Gates the app shell behind authentication. Renders the login page when the
// user is not authenticated, otherwise renders its children.
const AuthGate = observer(function AuthGate({
    children
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const container = useContainer();
    const authRepository = container.resolve(AuthRepository);
    const { presenter } = useFeature(LoginPageFeature);

    if (!authRepository.isAuthenticated) {
        return <LoginPage presenter={presenter} />;
    }

    return children;
});

// Subscribes to job status events via EventBridge and shows toast notifications
// for terminal job states. Renders nothing — it only manages the subscription.
function JobNotificationListener(): null {
    const container = useContainer();

    useEffect(() => {
        const eventBridge = container.resolve(EventBridge);
        const handler = createJobStatusNotificationHandler(container);
        eventBridge.on("job:status", handler);
        return () => {
            eventBridge.off("job:status", handler);
        };
    }, [container]);

    return null;
}

// Subscribes to snooze-expiry events via EventBridge and shows toast
// notifications when snoozed vulnerabilities expire. Renders nothing — it only
// manages the subscription.
function SnoozeExpiryListener(): null {
    const container = useContainer();

    useEffect(() => {
        const eventBridge = container.resolve(EventBridge);
        eventBridge.on("snooze:expired", handleSnoozeExpired);
        return () => {
            eventBridge.off("snooze:expired", handleSnoozeExpired);
        };
    }, [container]);

    return null;
}

// Checks the config file for parse/validation errors on app mount and
// shows a toast notification if any are found. Renders nothing.
function ConfigErrorNotifier(): null {
    const container = useContainer();

    useEffect(() => {
        const pmGateway = container.resolve(PmSettingsGateway);
        const appGateway = container.resolve(AppSettingsGateway);

        Promise.all([pmGateway.listPmConfig(), appGateway.list()]).then(([pmResult, appResult]) => {
            const error = pmResult.configError ?? appResult.configError;
            if (error) {
                showConfigErrorToast(error);
            }
        });
    }, [container]);

    return null;
}

// Loads the list of teams once on app mount so the global team filter
// Select has data to render. Renders nothing.
function TeamListLoader(): null {
    const container = useContainer();

    useEffect(() => {
        const teamListService = container.resolve(TeamListService);
        void teamListService.loadTeams();
    }, [container]);

    return null;
}

// Renders the global team filter Select shown in the header. Wrapped in
// observer so it re-renders when the selected team or the loaded team list
// changes.
const TeamFilterSelect = observer(function TeamFilterSelect(): React.ReactNode {
    const container = useContainer();
    const teamFilterService = container.resolve(TeamFilterService);
    const teamListService = container.resolve(TeamListService);

    const teams = teamListService.getTeams();
    const teamOptions = teams.map(team => ({
        value: team.id,
        label: team.name
    }));

    return (
        <Select
            placeholder="All Teams"
            clearable
            searchable
            size="xs"
            value={teamFilterService.selectedTeamId}
            onChange={value => teamFilterService.setSelectedTeamId(value)}
            data={teamOptions}
            renderOption={({ option }) => {
                const team = teams.find(item => item.id === option.value);
                return (
                    <Group gap="xs" wrap="nowrap">
                        <ColorSwatch color={team?.color ?? "gray"} size={12} />
                        <span>{option.label}</span>
                    </Group>
                );
            }}
        />
    );
});

// Shows the current user's display name in the header and offers a Logout
// action in its dropdown. Renders nothing when no user is authenticated yet.
const UserMenu = observer(function UserMenu(): React.ReactNode {
    const container = useContainer();
    const authRepository = container.resolve(AuthRepository);
    const currentUser = authRepository.currentUser;

    if (!currentUser) {
        return null;
    }

    async function handleLogout(): Promise<void> {
        const authGateway = container.resolve(AuthGateway);
        try {
            await authGateway.logout();
        } finally {
            authRepository.clearAuth();
        }
    }

    return (
        <Menu position="bottom-end" shadow="md" width={180}>
            <Menu.Target>
                <Button variant="subtle" size="xs">
                    {currentUser.displayName}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item onClick={() => void handleLogout()}>Logout</Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
});

function SbomDialogContainer({
    opened,
    onClose
}: {
    opened: boolean;
    onClose: () => void;
}): React.ReactNode {
    const container = useContainer();
    const presenter = container.resolve(SbomPresenter);

    return <SbomExportDialog opened={opened} onClose={onClose} presenter={presenter} />;
}

function AppRoutes(): React.ReactNode {
    const path = useCurrentPath();

    if (path === "/jobs") {
        return (
            <JobManagerProvider>
                {({ presenter }) => <JobManagerPage presenter={presenter} />}
            </JobManagerProvider>
        );
    }

    if (path === "/settings") {
        return (
            <PmSettingsProvider>
                {({ presenter }) => <PmSettingsPage presenter={presenter} />}
            </PmSettingsProvider>
        );
    }

    if (path === "/settings/app") {
        return (
            <AppSettingsProvider>
                {({ presenter }) => <AppSettingsPage presenter={presenter} />}
            </AppSettingsProvider>
        );
    }

    if (path === "/logs") {
        return (
            <LogBrowserProvider>
                {({ presenter }) => <LogBrowserPage presenter={presenter} />}
            </LogBrowserProvider>
        );
    }

    if (path === "/backup") {
        return (
            <BackupProvider>
                {({ presenter }) => <BackupPage presenter={presenter} />}
            </BackupProvider>
        );
    }

    const vulnerabilityDetailMatch = VULNERABILITY_DETAIL_PATH_PATTERN.exec(path);
    const vulnerabilityId = vulnerabilityDetailMatch?.[1];

    if (vulnerabilityId) {
        return (
            <VulnerabilityDetailProvider>
                {({ presenter }) => (
                    <VulnerabilityDetailPage
                        presenter={presenter}
                        vulnerabilityId={vulnerabilityId}
                    />
                )}
            </VulnerabilityDetailProvider>
        );
    }

    if (path === "/vulnerabilities") {
        return (
            <VulnerabilitiesProvider>
                {({ presenter }) => <VulnerabilitiesPage presenter={presenter} />}
            </VulnerabilitiesProvider>
        );
    }

    if (path === "/licenses") {
        return (
            <LicensesProvider>
                {({ presenter }) => <LicensesPage presenter={presenter} />}
            </LicensesProvider>
        );
    }

    if (path === "/trends") {
        return (
            <TrendsProvider>
                {({ presenter }) => <TrendsPage presenter={presenter} />}
            </TrendsProvider>
        );
    }

    const teamDetailMatch = TEAM_DETAIL_PATH_PATTERN.exec(path);
    const teamDetailId = teamDetailMatch?.[1];

    if (teamDetailId) {
        return (
            <TeamDetailProvider>
                {({ presenter }) => <TeamDetailPage presenter={presenter} teamId={teamDetailId} />}
            </TeamDetailProvider>
        );
    }

    if (path === "/teams") {
        return (
            <TeamsProvider>{({ presenter }) => <TeamsPage presenter={presenter} />}</TeamsProvider>
        );
    }

    if (path === "/users") {
        return (
            <UserListProvider>
                {({ presenter }) => <UserListPage presenter={presenter} />}
            </UserListProvider>
        );
    }

    if (path === "/packages") {
        return (
            <PackagesProvider>
                {({ presenter }) => <PackagesPage presenter={presenter} />}
            </PackagesProvider>
        );
    }

    const upgradeWizardMatch = UPGRADE_WIZARD_PATH_PATTERN.exec(path);
    const upgradeWizardProjectId = upgradeWizardMatch?.[1];

    if (upgradeWizardProjectId) {
        return (
            <UpgradeWizardProvider>
                {({ presenter }) => (
                    <UpgradeWizardPage presenter={presenter} projectId={upgradeWizardProjectId} />
                )}
            </UpgradeWizardProvider>
        );
    }

    const stepHooksMatch = STEP_HOOKS_PATH_PATTERN.exec(path);
    const stepHooksProjectId = stepHooksMatch?.[1];

    if (stepHooksProjectId) {
        return (
            <StepHooksProvider>
                {({ presenter }) => (
                    <StepHooksPage presenter={presenter} projectId={stepHooksProjectId} />
                )}
            </StepHooksProvider>
        );
    }

    const dependencyGraphMatch = DEPENDENCY_GRAPH_PATH_PATTERN.exec(path);
    const dependencyGraphProjectId = dependencyGraphMatch?.[1];

    if (dependencyGraphProjectId) {
        return (
            <DependencyGraphProvider>
                {({ presenter }) => (
                    <DependencyGraphPage
                        presenter={presenter}
                        projectId={dependencyGraphProjectId}
                    />
                )}
            </DependencyGraphProvider>
        );
    }

    if (path === "/projects") {
        return (
            <ProjectListProvider>
                {({ presenter }) => <ProjectListPage presenter={presenter} />}
            </ProjectListProvider>
        );
    }

    const projectDetailMatch = PROJECT_DETAIL_PATH_PATTERN.exec(path);
    const projectId = projectDetailMatch?.[1];

    if (projectId) {
        return (
            <ProjectDetailProvider>
                {({ presenter }) => (
                    <ProjectDetailPage presenter={presenter} projectId={projectId} />
                )}
            </ProjectDetailProvider>
        );
    }

    return (
        <DashboardProvider>
            {({ presenter }) => <DashboardPage presenter={presenter} />}
        </DashboardProvider>
    );
}

export function App(): React.ReactNode {
    const [sbomDialogOpened, setSbomDialogOpened] = useState(false);

    return (
        <ContainerProvider features={ALL_FEATURES}>
            <SessionRestorer />
            <MagicLinkHandler />
            <MantineProvider>
                <Notifications position="top-right" />
                <AuthGate>
                    <WebSocketConnector />
                    <JobNotificationListener />
                    <SnoozeExpiryListener />
                    <ConfigErrorNotifier />
                    <TeamListLoader />
                    <AppShell header={{ height: 60 }} padding="md">
                        <AppShell.Header>
                            <Group h="100%" px="md" justify="space-between">
                                <Group gap="md">
                                    <Title order={3}>Dependency Manager</Title>
                                    <TeamFilterSelect />
                                </Group>
                                <Group gap="xs">
                                    <ActionIcon
                                        variant="subtle"
                                        size="lg"
                                        onClick={() => navigate("/")}
                                        aria-label="Home"
                                    >
                                        &#8962;
                                    </ActionIcon>
                                    <UserMenu />
                                    <Menu position="bottom-end" shadow="md" width={200}>
                                        <Menu.Target>
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                aria-label="Menu"
                                            >
                                                &#9776;
                                            </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                            <Menu.Item onClick={() => navigate("/")}>
                                                Dashboard
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/projects")}>
                                                Projects
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/packages")}>
                                                Packages
                                            </Menu.Item>
                                            <Menu.Divider />
                                            <Menu.Item onClick={() => navigate("/vulnerabilities")}>
                                                Vulnerabilities
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/licenses")}>
                                                Licenses
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/trends")}>
                                                Trends
                                            </Menu.Item>
                                            <Menu.Item onClick={() => setSbomDialogOpened(true)}>
                                                SBOM Export
                                            </Menu.Item>
                                            <Menu.Divider />
                                            <Menu.Item onClick={() => navigate("/teams")}>
                                                Teams
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/users")}>
                                                Users
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/jobs")}>
                                                Jobs
                                            </Menu.Item>
                                            <Menu.Divider />
                                            <Menu.Item onClick={() => navigate("/settings")}>
                                                PM Settings
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/settings/app")}>
                                                Templates
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/logs")}>
                                                Logs
                                            </Menu.Item>
                                            <Menu.Item onClick={() => navigate("/backup")}>
                                                Backup
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                </Group>
                            </Group>
                        </AppShell.Header>
                        <AppShell.Main>
                            <AppRoutes />
                        </AppShell.Main>
                    </AppShell>
                    <SbomDialogContainer
                        opened={sbomDialogOpened}
                        onClose={() => setSbomDialogOpened(false)}
                    />
                </AuthGate>
            </MantineProvider>
        </ContainerProvider>
    );
}
