import type React from "react";
import { Card, Text, SimpleGrid } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";

interface SummaryCardsProps {
    summary: DashboardPresenter.ViewModel["summary"];
    openAutoFixPrCount: DashboardPresenter.ViewModel["openAutoFixPrCount"];
}

function scoreColor(score: number): string {
    if (score > 80) {
        return "green";
    }
    if (score > 50) {
        return "yellow";
    }
    return "red";
}

export function SummaryCards({ summary, openAutoFixPrCount }: SummaryCardsProps): React.ReactNode {
    if (!summary) {
        return null;
    }

    return (
        <SimpleGrid cols={4}>
            <Card shadow="sm" padding="lg" withBorder>
                <Text size="sm" c="dimmed">
                    Total Projects
                </Text>
                <Text size="xl" fw={700}>
                    {summary.totalProjects}
                </Text>
                <Text
                    size="xs"
                    c="blue"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/projects")}
                >
                    View all
                </Text>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
                <Text size="sm" c="dimmed">
                    Average Health
                </Text>
                <Text size="xl" fw={700} c={scoreColor(summary.averageScore)}>
                    {summary.averageScore}%
                </Text>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
                <Text size="sm" c="dimmed">
                    Worst Project
                </Text>
                {summary.worstProject ? (
                    <>
                        <Text size="xl" fw={700} c="red">
                            {summary.worstProject.score}%
                        </Text>
                        <Text
                            size="xs"
                            c="blue"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/Projects/${summary.worstProject!.id}`)}
                        >
                            {summary.worstProject.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {summary.worstProject.majorOutdated} major,{" "}
                            {summary.worstProject.minorOutdated} minor,{" "}
                            {summary.worstProject.patchOutdated} patch outdated of{" "}
                            {summary.worstProject.totalPackages}
                        </Text>
                    </>
                ) : (
                    <Text size="xl" fw={700} c="dimmed">
                        —
                    </Text>
                )}
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
                <Text size="sm" c="dimmed">
                    Open Auto-fix PRs
                </Text>
                <Text size="xl" fw={700}>
                    {openAutoFixPrCount}
                </Text>
            </Card>
        </SimpleGrid>
    );
}
