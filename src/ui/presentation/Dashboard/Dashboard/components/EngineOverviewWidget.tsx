import type React from "react";
import { Card, SimpleGrid, Text } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { EnginesGateway } from "#ui/features/Engines/abstractions/EnginesGateway.js";

interface EngineOverviewWidgetProps {
    summary: EnginesGateway.SummaryData | null;
}

export function EngineOverviewWidget({ summary }: EngineOverviewWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                Node.js Engine Status
            </Text>

            {!summary || summary.totalProjects === 0 ? (
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
                            {summary.counts.eol}
                        </Text>
                    </div>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                        <Text size="sm" c="dimmed">
                            Maintenance
                        </Text>
                        <Text size="xl" fw={700} c="yellow.8">
                            {summary.counts.maintenance}
                        </Text>
                    </div>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                        <Text size="sm" c="dimmed">
                            Current / LTS
                        </Text>
                        <Text size="xl" fw={700} c="green">
                            {summary.counts.current + summary.counts.activeLts}
                        </Text>
                    </div>
                </SimpleGrid>
            )}
        </Card>
    );
}
