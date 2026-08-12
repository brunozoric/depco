import type React from "react";
import { Card, Text, Stack, Group, Badge, Button } from "@mantine/core";
import type { ChangelogsGateway } from "#ui/features/Changelogs/abstractions/ChangelogsGateway.js";

interface ChangelogResolutionWidgetProps {
    stats: ChangelogsGateway.Stats | null;
    reResolving: boolean;
    onReResolveAll: () => void;
}

export function ChangelogResolutionWidget({
    stats,
    reResolving,
    onReResolveAll
}: ChangelogResolutionWidgetProps): React.ReactNode {
    return (
        <Card shadow="sm" padding="lg" withBorder>
            <Text fw={600} mb="md">
                Changelog Resolution
            </Text>

            {!stats || stats.total === 0 ? (
                <Text c="dimmed" size="sm">
                    No changelog data available.
                </Text>
            ) : (
                <Stack gap="sm">
                    <Group gap="xs">
                        <Badge color="green" variant="light">
                            {stats.resolved} resolved
                        </Badge>
                        <Badge color="red" variant="light">
                            {stats.failed} failed
                        </Badge>
                        <Badge color="yellow" variant="light">
                            {stats.pending} pending
                        </Badge>
                    </Group>

                    {Object.entries(stats.byResolver).length > 0 && (
                        <Stack gap={4}>
                            {Object.entries(stats.byResolver).map(([source, count]) => (
                                <Text key={source} size="sm" c="dimmed">
                                    {source}: {count}
                                </Text>
                            ))}
                        </Stack>
                    )}

                    <Button
                        size="sm"
                        variant="light"
                        disabled={reResolving || stats.failed === 0}
                        onClick={onReResolveAll}
                    >
                        Re-resolve all failed
                    </Button>
                </Stack>
            )}
        </Card>
    );
}
