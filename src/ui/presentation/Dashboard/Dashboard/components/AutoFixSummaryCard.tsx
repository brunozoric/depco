import type React from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";

interface AutoFixSummaryCardProps {
    data: DashboardGateway.AutoFixTrendPoint[];
}

export function AutoFixSummaryCard({ data }: AutoFixSummaryCardProps): React.ReactNode {
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
                        Auto-Fix Pull Requests
                    </Text>
                    <Text size="xs" c="dimmed">
                        created (7d)
                    </Text>
                </Stack>
                <ResponsiveContainer width={120} height={40}>
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="created"
                            stroke="#228be6"
                            dot={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Group>
        </Card>
    );
}
