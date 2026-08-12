import type React from "react";
import { Badge, Card, SimpleGrid, Text } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { EnginesGateway } from "#ui/features/Engines/abstractions/EnginesGateway.js";

interface EngineOverviewWidgetProps {
    summary: EnginesGateway.SummaryData | null;
}

interface ProjectEngineStatusCounts {
    eol: number;
    maintenance: number;
    current: number;
}

function countProjectsByRootStatus(
    projectSummaries: EnginesGateway.ProjectSummary[]
): ProjectEngineStatusCounts {
    const counts: ProjectEngineStatusCounts = { eol: 0, maintenance: 0, current: 0 };

    for (const project of projectSummaries) {
        if (project.rootStatus === "eol") {
            counts.eol++;
        } else if (project.rootStatus === "maintenance") {
            counts.maintenance++;
        } else if (project.rootStatus === "current" || project.rootStatus === "active-lts") {
            counts.current++;
        }
    }

    return counts;
}

export function EngineOverviewWidget({ summary }: EngineOverviewWidgetProps): React.ReactNode {
    const projectCounts = summary ? countProjectsByRootStatus(summary.projectSummaries) : null;

    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                Node.js Engine Status
            </Text>

            {!summary || summary.totalProjects === 0 || !projectCounts ? (
                <Text c="dimmed" size="sm">
                    No engine scan data available.
                </Text>
            ) : (
                <SimpleGrid cols={3}>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                        <Text size="sm" c="dimmed">
                            EOL
                        </Text>
                        <Text size="xl" fw={700} c="red">
                            {projectCounts.eol}
                        </Text>
                    </div>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                        <Text size="sm" c="dimmed">
                            Maintenance
                        </Text>
                        <Text size="xl" fw={700} c="yellow.8">
                            {projectCounts.maintenance}
                        </Text>
                    </div>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                        <Text size="sm" c="dimmed">
                            Current / LTS
                        </Text>
                        <Text size="xl" fw={700} c="green">
                            {projectCounts.current}
                        </Text>
                    </div>
                </SimpleGrid>
            )}

            {summary && summary.staleProjectCount > 0 && (
                <Badge color="orange" variant="light" mt="sm">
                    {summary.staleProjectCount} project{summary.staleProjectCount !== 1 ? "s" : ""}{" "}
                    stale
                </Badge>
            )}
        </Card>
    );
}
