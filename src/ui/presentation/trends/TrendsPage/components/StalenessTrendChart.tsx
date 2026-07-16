import type React from "react";
import { Card, Group, SegmentedControl, Text } from "@mantine/core";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";

interface StalenessTrendChartProps {
    data: DashboardGateway.StalenessTrendPoint[];
    range: string;
    onRangeChange: (range: string) => void;
}

const RANGE_OPTIONS = [
    { value: "7", label: "7d" },
    { value: "30", label: "30d" },
    { value: "90", label: "90d" }
];

export function StalenessTrendChart({
    data,
    range,
    onRangeChange
}: StalenessTrendChartProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Dependency Staleness Trend</Text>
                <SegmentedControl
                    data={RANGE_OPTIONS}
                    value={range}
                    onChange={onRangeChange}
                    size="xs"
                />
            </Group>

            {data.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    No staleness data yet — run a scan to start tracking trends
                </Text>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="patchOutdated"
                            stackId="staleness"
                            stroke="#228be6"
                            fill="#228be6"
                        />
                        <Area
                            type="monotone"
                            dataKey="minorOutdated"
                            stackId="staleness"
                            stroke="#fab005"
                            fill="#fab005"
                        />
                        <Area
                            type="monotone"
                            dataKey="majorOutdated"
                            stackId="staleness"
                            stroke="#fa5252"
                            fill="#fa5252"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
