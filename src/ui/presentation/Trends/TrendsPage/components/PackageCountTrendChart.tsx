import type React from "react";
import { Card, Group, Text } from "@mantine/core";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import type { TrendsPresenter } from "../abstractions/TrendsPresenter.js";

interface PackageCountTrendChartProps {
    data: TrendsPresenter.PackageCountPoint[];
    range: string;
}

export function PackageCountTrendChart({
    data,
    range
}: PackageCountTrendChartProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Total Package Count</Text>
                <Text size="xs" c="dimmed">
                    {range}d
                </Text>
            </Group>

            {data.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    No package count data yet — run a scan to start tracking trends
                </Text>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="totalPackages"
                            stroke="#228be6"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
