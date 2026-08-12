import type React from "react";
import { Accordion, Anchor, Badge, Group, Stack, Text, Title } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import { SEVERITY_COLORS } from "#ui/infrastructure/Shared/vulnerabilities/severityColors.js";

interface PackageDetailVulnerabilitiesSectionProps {
    vulnerabilities: VulnerabilitiesGateway.VulnerabilityItem[];
}

export function PackageDetailVulnerabilitiesSection({
    vulnerabilities
}: PackageDetailVulnerabilitiesSectionProps): React.ReactNode {
    return (
        <Stack gap="sm">
            <Title order={4}>Vulnerabilities</Title>
            {vulnerabilities.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No known vulnerabilities.
                </Text>
            ) : (
                <Accordion>
                    {vulnerabilities.map(vulnerability => (
                        <Accordion.Item key={vulnerability.id} value={vulnerability.id}>
                            <Accordion.Control>
                                <Group gap="xs">
                                    <Badge color={SEVERITY_COLORS[vulnerability.severity]}>
                                        {vulnerability.severity}
                                    </Badge>
                                    <Text size="sm">{vulnerability.title}</Text>
                                </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                                <Stack gap={4}>
                                    <Text size="sm">
                                        Project:{" "}
                                        <Anchor
                                            component="button"
                                            size="sm"
                                            onClick={() =>
                                                navigate(`/projects/${vulnerability.projectId}`)
                                            }
                                        >
                                            {vulnerability.projectName}
                                        </Anchor>
                                    </Text>
                                    <Text size="sm">
                                        Installed version:{" "}
                                        {vulnerability.installedVersion ?? "Unknown"}
                                    </Text>
                                    <Text size="sm">
                                        Fix version: {vulnerability.fixVersion ?? "Unknown"}
                                    </Text>
                                    {vulnerability.cveId && (
                                        <Text size="sm">CVE: {vulnerability.cveId}</Text>
                                    )}
                                </Stack>
                            </Accordion.Panel>
                        </Accordion.Item>
                    ))}
                </Accordion>
            )}
        </Stack>
    );
}
