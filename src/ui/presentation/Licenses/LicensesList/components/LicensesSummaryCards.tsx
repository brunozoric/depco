import type React from "react";
import { Card, SimpleGrid, Text } from "@mantine/core";
import type { LicensesPresenter } from "../abstractions/LicensesPresenter.js";

interface LicensesSummaryCardsProps {
    summary: LicensesPresenter.ComplianceSummary;
}

export function LicensesSummaryCards({ summary }: LicensesSummaryCardsProps): React.ReactNode {
    return (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <Card withBorder padding="md">
                <Text size="sm" c="dimmed">
                    Total Packages
                </Text>
                <Text size="xl" fw={700}>
                    {summary.totalPackages}
                </Text>
            </Card>
            <Card withBorder padding="md">
                <Text size="sm" c="dimmed">
                    Compliant
                </Text>
                <Text size="xl" fw={700}>
                    {summary.compliantPercent}%
                </Text>
            </Card>
            <Card withBorder padding="md">
                <Text size="sm" c="dimmed">
                    Deny Violations
                </Text>
                <Text size="xl" fw={700} c="red">
                    {summary.denyCount}
                </Text>
            </Card>
            <Card withBorder padding="md">
                <Text size="sm" c="dimmed">
                    Warn Violations
                </Text>
                <Text size="xl" fw={700} c="yellow.8">
                    {summary.warnCount}
                </Text>
            </Card>
        </SimpleGrid>
    );
}
