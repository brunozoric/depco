import type React from "react";
import { ActionIcon, Anchor, Badge, Group, Stack, Text, Title } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";
import { formatDate } from "#ui/infrastructure/Shared/formatting/dateFormatters.js";

interface PackageDetailHeaderProps {
    packageDetail: PackagesGateway.PackageDetail;
}

function isSafeRepoUrl(url: string): boolean {
    return url.startsWith("http://") || url.startsWith("https://");
}

export function PackageDetailHeader({ packageDetail }: PackageDetailHeaderProps): React.ReactNode {
    return (
        <Stack gap={4}>
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/packages")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>{packageDetail.name}</Title>
                {packageDetail.registryResolved === false && (
                    <Badge color="yellow" size="xs" variant="light">
                        Pending
                    </Badge>
                )}
            </Group>
            <Group gap="lg" pl={48}>
                {packageDetail.repoUrl && isSafeRepoUrl(packageDetail.repoUrl) && (
                    <Anchor href={packageDetail.repoUrl} target="_blank" size="sm">
                        Repository
                    </Anchor>
                )}
                <Text size="sm" c="dimmed">
                    Latest: {packageDetail.latestVersion ?? "Unknown"}
                </Text>
                <Text size="sm" c="dimmed">
                    Last published: {formatDate(packageDetail.lastPublishedAt, "Unknown")}
                </Text>
            </Group>
        </Stack>
    );
}
