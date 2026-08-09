import type React from "react";
import { useState } from "react";
import { Badge, Button, Group, Modal, Skeleton, Stack, Table, Text } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";
import { computeVulnerabilityPenalty } from "#shared/vulnerabilities/types.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";

interface ScoreDetailModalProps {
    project: DashboardGateway.HealthProject | undefined;
    detail: DashboardPresenter.ViewModel["scoreDetail"];
    loading: boolean;
    onClose: () => void;
}

interface ScoreBreakdownProps {
    project: DashboardGateway.HealthProject;
}

interface OutdatedPackagesSectionProps {
    packages: DashboardGateway.ScoreDetailOutdatedPackage[];
    totalPackages: number;
}

interface VulnerabilitiesSectionProps {
    vulnerabilities: DashboardGateway.ScoreDetailVulnerability[];
}

const UPGRADE_BADGE_COLOR: Record<string, string> = {
    major: "red",
    minor: "yellow",
    patch: "green"
};

const SEVERITY_BADGE_COLOR: Record<string, string> = {
    critical: "red",
    high: "orange",
    moderate: "yellow",
    low: "blue"
};

const INITIAL_VISIBLE_COUNT = 10;

function ScoreBreakdown({ project }: ScoreBreakdownProps): React.ReactNode {
    const baseScore =
        project.totalPackages === 0 ? 100 : (project.upToDate / project.totalPackages) * 100;

    const penalty = computeVulnerabilityPenalty({
        critical: project.vulnerabilityCritical,
        high: project.vulnerabilityHigh,
        moderate: project.vulnerabilityModerate,
        low: project.vulnerabilityLow,
        info: 0
    });

    return (
        <Stack gap="xs">
            <Group justify="space-between">
                <Text size="sm">Base Score</Text>
                <Group gap="xs">
                    <Text size="sm" fw={600}>
                        {baseScore.toFixed(1)}%
                    </Text>
                    <Text size="xs" c="dimmed">
                        {project.upToDate} of {project.totalPackages} up-to-date
                    </Text>
                </Group>
            </Group>
            <Group justify="space-between">
                <Text size="sm">Vulnerability Penalty</Text>
                <Group gap="xs">
                    <Text size="sm" fw={600} c={penalty > 0 ? "red" : "dimmed"}>
                        {penalty > 0 ? `-${penalty}` : "0"}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {project.vulnerabilityCritical} critical · {project.vulnerabilityHigh} high
                        · {project.vulnerabilityModerate} moderate · {project.vulnerabilityLow} low
                    </Text>
                </Group>
            </Group>
            <Group
                justify="space-between"
                style={{
                    borderTop: "1px solid var(--mantine-color-default-border)",
                    paddingTop: 8
                }}
            >
                <Text size="sm" fw={700}>
                    Final Score
                </Text>
                <Text size="sm" fw={700}>
                    {project.score}%
                </Text>
            </Group>
        </Stack>
    );
}

function OutdatedPackagesSection({
    packages,
    totalPackages
}: OutdatedPackagesSectionProps): React.ReactNode {
    const [showAll, setShowAll] = useState(false);
    const impactPerPackage = totalPackages > 0 ? (1 / totalPackages) * 100 : 0;
    const visible = showAll ? packages : packages.slice(0, INITIAL_VISIBLE_COUNT);
    const hasMore = packages.length > INITIAL_VISIBLE_COUNT;

    return (
        <Stack gap="xs">
            <Text size="sm" fw={600}>
                Outdated Packages ({packages.length})
            </Text>
            {packages.length === 0 ? (
                <Text size="sm" c="dimmed">
                    All packages are up-to-date.
                </Text>
            ) : (
                <>
                    <Table striped>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Package</Table.Th>
                                <Table.Th>Current</Table.Th>
                                <Table.Th>Latest</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Impact</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {visible.map(pkg => (
                                <Table.Tr key={pkg.name}>
                                    <Table.Td>{pkg.name}</Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">
                                            {pkg.currentVersion}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs">{pkg.latestVersion}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            size="xs"
                                            color={UPGRADE_BADGE_COLOR[pkg.upgradeType] ?? "gray"}
                                        >
                                            {pkg.upgradeType}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="green">
                                            +{impactPerPackage.toFixed(1)}%
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                    {hasMore && (
                        <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => setShowAll(prev => !prev)}
                        >
                            {showAll ? "Show less" : `Show all (${packages.length})`}
                        </Button>
                    )}
                </>
            )}
        </Stack>
    );
}

function VulnerabilitiesSection({ vulnerabilities }: VulnerabilitiesSectionProps): React.ReactNode {
    if (vulnerabilities.length === 0) {
        return null;
    }

    return (
        <Stack gap="xs">
            <Text size="sm" fw={600}>
                Active Vulnerabilities ({vulnerabilities.length})
            </Text>
            <Table striped>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Package</Table.Th>
                        <Table.Th>Severity</Table.Th>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Fix</Table.Th>
                        <Table.Th>Penalty</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vulnerabilities.map((vulnerability, index) => (
                        <Table.Tr key={`${vulnerability.packageName}-${index}`}>
                            <Table.Td>{vulnerability.packageName}</Table.Td>
                            <Table.Td>
                                <Badge
                                    size="xs"
                                    color={SEVERITY_BADGE_COLOR[vulnerability.severity] ?? "gray"}
                                >
                                    {vulnerability.severity}
                                </Badge>
                            </Table.Td>
                            <Table.Td>
                                <Text size="xs" lineClamp={1}>
                                    {vulnerability.title}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="xs" c="dimmed">
                                    {vulnerability.fixVersion ?? "No fix"}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="xs" c="red">
                                    -{vulnerability.penalty}
                                </Text>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}

function DetailSkeleton(): React.ReactNode {
    return (
        <Stack gap="md">
            <Skeleton height={80} />
            <Skeleton height={120} />
        </Stack>
    );
}

export function ScoreDetailModal({
    project,
    detail,
    loading,
    onClose
}: ScoreDetailModalProps): React.ReactNode {
    if (!project) {
        return null;
    }

    return (
        <Modal
            opened={true}
            onClose={onClose}
            title={`Health Score — ${project.projectName}`}
            size="100%"
        >
            <Stack gap="md">
                <ScoreBreakdown project={project} />

                {loading ? (
                    <DetailSkeleton />
                ) : detail ? (
                    <>
                        <OutdatedPackagesSection
                            packages={detail.outdatedPackages}
                            totalPackages={project.totalPackages}
                        />
                        <VulnerabilitiesSection vulnerabilities={detail.vulnerabilities} />
                    </>
                ) : null}

                <Group justify="flex-end">
                    <Button
                        variant="light"
                        size="sm"
                        onClick={() => {
                            onClose();
                            navigate(`/Projects/${project.projectId}`);
                        }}
                    >
                        View Project
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
