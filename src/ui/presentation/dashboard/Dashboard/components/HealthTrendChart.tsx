import type React from "react";
import { Card, SegmentedControl, Group, Text } from "@mantine/core";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import type { DashboardGateway } from "#ui/features/dashboard/abstractions/DashboardGateway.js";

interface HealthTrendChartProps {
    trendData: DashboardGateway.TrendProject[];
    trendRange: string;
    onRangeChange: (range: string) => void;
}

const RANGE_OPTIONS = [
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
    { label: "90d", value: "90d" },
    { label: "All", value: "all" }
];

const LINE_COLORS = [
    "#228be6",
    "#40c057",
    "#fab005",
    "#fa5252",
    "#7950f2",
    "#15aabf",
    "#e64980",
    "#82c91e"
];

function lineColorFor(index: number): string {
    return LINE_COLORS[index % LINE_COLORS.length] ?? "#228be6";
}

export interface IChartDataPoint {
    date: string;
    [projectName: string]: string | number;
}

function buildChartData(trendData: DashboardGateway.TrendProject[]): IChartDataPoint[] {
    const dateMap = new Map<string, IChartDataPoint>();

    for (const project of trendData) {
        for (const snapshot of project.snapshots) {
            let point = dateMap.get(snapshot.date);
            if (!point) {
                point = { date: snapshot.date };
                dateMap.set(snapshot.date, point);
            }
            point[project.projectName] = snapshot.score;
        }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function HealthTrendChart({
    trendData,
    trendRange,
    onRangeChange
}: HealthTrendChartProps): React.ReactNode {
    const chartData = buildChartData(trendData);

    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Group justify="space-between" mb="md">
                <Text fw={600}>Health Trend</Text>
                <SegmentedControl
                    data={RANGE_OPTIONS}
                    value={trendRange}
                    onChange={onRangeChange}
                    size="xs"
                />
            </Group>

            {chartData.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    No trend data yet.
                </Text>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        {trendData.map((project, index) => (
                            <Line
                                key={project.projectId}
                                type="monotone"
                                dataKey={project.projectName}
                                stroke={lineColorFor(index)}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
