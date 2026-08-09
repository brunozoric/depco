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
import { createJobStatusNotificationHandler } from "./infrastructure/Shared/notifications/jobNotifications.js";
import { showConfigErrorToast } from "./infrastructure/Shared/notifications/configErrorNotification.js";
import { handleSnoozeExpired } from "./infrastructure/Shared/notifications/snoozeNotifications.js";
import { ContainerProvider, useContainer } from "#ui/infrastructure/Shared/di/ContainerProvider.js";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import { AuthGateway } from "#ui/features/Auth/abstractions/AuthGateway.js";
import { AuthRepository } from "#ui/features/Auth/abstractions/AuthRepository.js";
import { PmSettingsGateway } from "#ui/features/Settings/abstractions/PmSettingsGateway.js";
import { AppSettingsGateway } from "#ui/features/AppSettings/abstractions/AppSettingsGateway.js";
import { WebSocketListener } from "#ui/infrastructure/WebSocket/index.js";
import { EventBridge } from "#ui/infrastructure/Events/abstractions/EventBridge.js";
import "#ui/infrastructure/Events/eventMap.js";
import { TeamFilterService } from "#ui/features/TeamFilter/abstractions/TeamFilterService.js";
import { TeamListService } from "#ui/features/TeamFilter/abstractions/TeamListService.js";
import { PresentationFeature } from "./presentation/feature.js";
import { LoginPageFeature } from "./presentation/Auth/LoginPage/feature.js";
import { LoginPage } from "./presentation/Auth/LoginPage/LoginPage.js";
import { SbomExportDialog } from "./presentation/Sbom/SbomPage/components/SbomExportDialog.js";
import { SbomPresenter } from "./presentation/Sbom/SbomPage/abstractions/SbomPresenter.js";
import { RouterComponent } from "./infrastructure/Router/index.js";

const ALL_FEATURES = [PresentationFeature];

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

export function App(): React.ReactNode {
    const [sbomDialogOpened, setSbomDialogOpened] = useState(false);

    return (
        <ContainerProvider features={ALL_FEATURES}>
            <SessionRestorer />
            <MagicLinkHandler />
            <MantineProvider>
                <Notifications position="bottom-left" />
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
                            <RouterComponent />
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
