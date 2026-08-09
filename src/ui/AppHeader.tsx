import type React from "react";
import {
    ActionIcon,
    AppShell,
    Button,
    ColorSwatch,
    Menu,
    Title,
    Group,
    Select
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useContainer } from "#ui/infrastructure/Shared/di/ContainerProvider.js";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { AuthGateway } from "#ui/features/Auth/abstractions/AuthGateway.js";
import { AuthRepository } from "#ui/features/Auth/abstractions/AuthRepository.js";
import { TeamFilterService } from "#ui/features/TeamFilter/abstractions/TeamFilterService.js";
import { TeamListService } from "#ui/features/TeamFilter/abstractions/TeamListService.js";
import { LoginPageFeature } from "./presentation/Auth/LoginPage/feature.js";
import { LoginPage } from "./presentation/Auth/LoginPage/LoginPage.js";
import { SbomExportDialog } from "./presentation/Sbom/SbomPage/components/SbomExportDialog.js";
import { SbomPresenter } from "./presentation/Sbom/SbomPage/abstractions/SbomPresenter.js";

// Gates the app shell behind authentication. Renders the login page when the
// user is not authenticated, otherwise renders its children.
export const AuthGate = observer(function AuthGate({
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

export function SbomDialogContainer({
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

export interface AppHeaderProps {
    onSbomExportClick: () => void;
}

// Renders the top app-shell header bar: title, team filter, home button,
// user menu, and the main navigation menu.
export function AppHeader({ onSbomExportClick }: AppHeaderProps): React.ReactNode {
    return (
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
                            <ActionIcon variant="subtle" size="lg" aria-label="Menu">
                                &#9776;
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item onClick={() => navigate("/")}>Dashboard</Menu.Item>
                            <Menu.Item onClick={() => navigate("/projects")}>Projects</Menu.Item>
                            <Menu.Item onClick={() => navigate("/packages")}>Packages</Menu.Item>
                            <Menu.Divider />
                            <Menu.Item onClick={() => navigate("/vulnerabilities")}>
                                Vulnerabilities
                            </Menu.Item>
                            <Menu.Item onClick={() => navigate("/licenses")}>Licenses</Menu.Item>
                            <Menu.Item onClick={() => navigate("/trends")}>Trends</Menu.Item>
                            <Menu.Item onClick={onSbomExportClick}>SBOM Export</Menu.Item>
                            <Menu.Divider />
                            <Menu.Item onClick={() => navigate("/teams")}>Teams</Menu.Item>
                            <Menu.Item onClick={() => navigate("/users")}>Users</Menu.Item>
                            <Menu.Item onClick={() => navigate("/jobs")}>Jobs</Menu.Item>
                            <Menu.Divider />
                            <Menu.Item onClick={() => navigate("/settings")}>PM Settings</Menu.Item>
                            <Menu.Item onClick={() => navigate("/settings/app")}>
                                Templates
                            </Menu.Item>
                            <Menu.Item onClick={() => navigate("/logs")}>Logs</Menu.Item>
                            <Menu.Item onClick={() => navigate("/backup")}>Backup</Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>
        </AppShell.Header>
    );
}
