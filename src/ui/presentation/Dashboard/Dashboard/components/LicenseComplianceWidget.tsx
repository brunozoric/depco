import type React from "react";
import { Card, Text, Stack, Group, Badge, Anchor } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "#ui/features/Dashboard/abstractions/DashboardGateway.js";
import { RISK_TIER_VALUES } from "#shared/licenses/types.js";
import { RISK_TIER_COLORS } from "#ui/shared/licenses/riskTierColors.js";

interface LicenseComplianceWidgetProps {
    summary: DashboardGateway.LicenseComplianceSummary | null;
}

export function LicenseComplianceWidget({
    summary
}: LicenseComplianceWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                License Compliance
            </Text>

            {!summary || summary.totalPackages === 0 ? (
                <Text c="dimmed" size="sm">
                    No license data available.
                </Text>
            ) : (
                <Stack gap="sm">
                    <Group justify="space-between">
                        <Text size="xl" fw={700}>
                            {summary.totalPackages} packages
                        </Text>
                        <Text size="sm" c="dimmed">
                            {summary.compliantPercent}% compliant
                        </Text>
                    </Group>

                    <Group gap="xs">
                        {summary.violationCounts.deny > 0 && (
                            <Badge color="red" variant="light">
                                {summary.violationCounts.deny} deny violations
                            </Badge>
                        )}
                        {summary.violationCounts.warn > 0 && (
                            <Badge color="yellow" variant="light">
                                {summary.violationCounts.warn} warnings
                            </Badge>
                        )}
                    </Group>

                    <Group gap="xs">
                        {RISK_TIER_VALUES.map(tier => {
                            const count = summary.riskTierCounts[tier];
                            if (count === 0) {
                                return null;
                            }
                            return (
                                <Badge key={tier} color={RISK_TIER_COLORS[tier]} variant="light">
                                    {count} {tier}
                                </Badge>
                            );
                        })}
                    </Group>

                    <Anchor component="button" size="sm" onClick={() => navigate("/licenses")}>
                        View all
                    </Anchor>
                </Stack>
            )}
        </Card>
    );
}
