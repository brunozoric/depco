import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { ColorSwatch, Group, Skeleton, Stack, Text, Title, Badge } from "@mantine/core";
import type { TeamDetailPresenter } from "../abstractions/TeamDetailPresenter.js";
import { DashboardPage } from "../../../Dashboard/Dashboard/components/DashboardPage.js";

interface TeamDetailPageProps {
    presenter: TeamDetailPresenter.Interface;
    teamId: string;
}

export const TeamDetailPage = observer(function TeamDetailPage({
    presenter,
    teamId
}: TeamDetailPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load(teamId);
        return () => presenter.dispose();
    }, [presenter, teamId]);

    const { vm } = presenter;

    if (vm.loading) {
        return (
            <Stack>
                <Skeleton height={40} />
                <Skeleton height={200} />
            </Stack>
        );
    }

    if (vm.error) {
        return <Text c="red">{vm.error}</Text>;
    }

    return (
        <Stack>
            <Group gap="md">
                <ColorSwatch color={vm.teamColor} size={24} />
                <Title order={2}>{vm.teamName}</Title>
                <Badge variant="light">{vm.projectCount} projects</Badge>
            </Group>

            <DashboardPage presenter={presenter.dashboardPresenter} />
        </Stack>
    );
});
