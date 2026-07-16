import type React from "react";
import { Card, Group, SegmentedControl, Text } from "@mantine/core";
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
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";

interface AutoFixTrendChartProps {
    data: DashboardGateway.AutoFixTrendPoint[];
    range: string;
    onRangeChange: (range: string) => void;
}

const RANGE_OPTIONS = [
    { value: "7", label: "7d" },
    { value: "30", label: "30d" },
    { value: "90", label: "90d" }
];

export function AutoFixTrendChart({
    data,
    range,
    onRangeChange
}: AutoFixTrendChartProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Auto-Fix Trend</Text>
                <SegmentedControl
                    data={RANGE_OPTIONS}
                    value={range}
                    onChange={onRangeChange}
                    size="xs"
                />
            </Group>

            {data.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    No auto-fix data yet — enable auto-fix to start tracking trends
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
                            dataKey="pending"
                            stroke="#fab005"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="created"
                            stroke="#228be6"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="merged"
                            stroke="#40c057"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="closed"
                            stroke="#868e96"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="failed"
                            stroke="#fa5252"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
