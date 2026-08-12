import type React from "react";
import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import type { LicensesGateway } from "../../../../features/Licenses/abstractions/LicensesGateway.js";
import { RISK_TIER_COLORS } from "#ui/infrastructure/Shared/licenses/riskTierColors.js";

interface PackageDetailLicenseSectionProps {
    licenses: LicensesGateway.LicenseItem[];
}

export function PackageDetailLicenseSection({
    licenses
}: PackageDetailLicenseSectionProps): React.ReactNode {
    return (
        <Stack gap="sm">
            <Title order={4}>License</Title>
            {licenses.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No license information found.
                </Text>
            ) : (
                <Stack gap="xs">
                    {licenses.map(license => (
                        <Group key={license.id} gap="xs">
                            <Text size="sm">{license.licenseName}</Text>
                            {license.spdxId && (
                                <Text size="xs" c="dimmed">
                                    ({license.spdxId})
                                </Text>
                            )}
                            <Badge color={RISK_TIER_COLORS[license.riskTier]} size="sm">
                                {license.riskTier}
                            </Badge>
                        </Group>
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
