import type React from "react";
import { Accordion, Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import Markdown from "react-markdown";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";

interface PackageDetailChangelogSectionProps {
    changelogs: PackagesGateway.ChangelogEntry[];
    resolving: boolean;
    onReResolve: () => void;
}

export function PackageDetailChangelogSection({
    changelogs,
    resolving,
    onReResolve
}: PackageDetailChangelogSectionProps): React.ReactNode {
    return (
        <Stack gap="sm">
            <Group justify="space-between">
                <Title order={4}>Changelog</Title>
                <Button size="xs" variant="subtle" loading={resolving} onClick={onReResolve}>
                    Re-resolve
                </Button>
            </Group>
            {changelogs.length === 0 ? (
                <Text c="dimmed" size="sm">
                    No changelog entries found.
                </Text>
            ) : (
                <Accordion>
                    {changelogs.map(entry => (
                        <Accordion.Item key={entry.version} value={entry.version}>
                            <Accordion.Control>
                                <Group gap="xs">
                                    <Text fw={500}>{entry.version}</Text>
                                    {entry.source && entry.source !== "none" && (
                                        <Badge size="xs" variant="light">
                                            {entry.source}
                                        </Badge>
                                    )}
                                </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                                {entry.content ? (
                                    <Markdown>{entry.content}</Markdown>
                                ) : (
                                    <Text c="dimmed" size="sm">
                                        No changelog available
                                    </Text>
                                )}
                            </Accordion.Panel>
                        </Accordion.Item>
                    ))}
                </Accordion>
            )}
        </Stack>
    );
}
