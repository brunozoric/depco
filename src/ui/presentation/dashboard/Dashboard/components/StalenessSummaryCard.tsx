import type React from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";

interface StalenessSummaryCardProps {
    data: DashboardGateway.StalenessTrendPoint[];
}

export function StalenessSummaryCard({ data }: StalenessSummaryCardProps): React.ReactNode {
    return (
        <Card
            withBorder
            padding="md"
            onClick={() => navigate("/trends")}
            style={{ cursor: "pointer" }}
        >
            <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                        Dependency Staleness
                    </Text>
                    <Text size="xs" c="dimmed">
                        major outdated (7d)
                    </Text>
                </Stack>
                <ResponsiveContainer width={120} height={40}>
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="majorOutdated"
                            stroke="#fa5252"
                            dot={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Group>
        </Card>
    );
}
