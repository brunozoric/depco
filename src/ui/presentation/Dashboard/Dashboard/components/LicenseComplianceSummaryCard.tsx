import type React from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";

interface LicenseComplianceSummaryCardProps {
    data: DashboardGateway.LicenseTrendPoint[];
}

export function LicenseComplianceSummaryCard({
    data
}: LicenseComplianceSummaryCardProps): React.ReactNode {
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
                        License Compliance
                    </Text>
                    <Text size="xs" c="dimmed">
                        compliant packages (7d)
                    </Text>
                </Stack>
                <ResponsiveContainer width={120} height={40}>
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="compliantCount"
                            stroke="#40c057"
                            dot={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Group>
        </Card>
    );
}
