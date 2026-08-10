import type React from "react";
import { useState, useEffect } from "react";
import { Accordion, Badge, Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import Markdown from "react-markdown";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import type { IChangelogTrackingState } from "../../../Shared/ChangelogTracker.js";
import type { IStartChangelogTrackingInput } from "../../../Shared/ChangelogTracker.js";

interface ChangelogModalProps {
    opened: boolean;
    onClose: () => void;
    packageName: string;
    currentVersion: string;
    latestVersion: string;
    getChangelogs: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<ProjectDetailPresenter.ChangelogResult>;
    onRefresh?: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<ProjectDetailPresenter.ChangelogResult>;
    changelogState: IChangelogTrackingState | null;
    onStartTracking: (input: IStartChangelogTrackingInput) => void;
}

export function ChangelogModal({
    opened,
    onClose,
    packageName,
    currentVersion,
    latestVersion,
    getChangelogs,
    onRefresh,
    changelogState,
    onStartTracking
}: ChangelogModalProps): React.ReactNode {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    async function handleRefresh(): Promise<void> {
        if (!onRefresh) {
            return;
        }
        setRefreshing(true);
        try {
            const result = await onRefresh(packageName, currentVersion, latestVersion);
            onStartTracking({
                packageName,
                entries: result.entries.reverse(),
                resolving: result.resolving
            });
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        if (!opened) {
            return;
        }

        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const result = await getChangelogs(packageName, currentVersion, latestVersion);
                if (!cancelled) {
                    onStartTracking({
                        packageName,
                        entries: result.entries.reverse(),
                        resolving: result.resolving
                    });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [opened, packageName, currentVersion, latestVersion, getChangelogs, onStartTracking]);

    const entries = changelogState?.entries ?? [];
    const resolving = changelogState?.resolving ?? false;
    const resolvedCount = changelogState?.resolvedCount ?? 0;
    const totalToResolve = changelogState?.totalToResolve ?? 0;

    return (
        <Modal opened={opened} onClose={onClose} title={`Changelog — ${packageName}`} size="lg">
            {loading ? (
                <Loader />
            ) : (
                <Stack gap="md">
                    {onRefresh && (
                        <Group justify="flex-end">
                            <Button
                                size="xs"
                                variant="subtle"
                                loading={refreshing}
                                onClick={handleRefresh}
                            >
                                Re-fetch
                            </Button>
                        </Group>
                    )}
                    {entries.length === 0 ? (
                        <Text c="dimmed">No changelog entries found.</Text>
                    ) : (
                        <Accordion>
                            {entries.map(entry => (
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
                    {resolving && (
                        <Group gap="xs" justify="center" py="sm">
                            <Loader size="xs" />
                            <Text size="xs" c="dimmed">
                                Fetching changelogs...
                                {totalToResolve > 0 &&
                                    ` ${Math.min(100, Math.round((resolvedCount / totalToResolve) * 100))}%`}
                            </Text>
                        </Group>
                    )}
                </Stack>
            )}
        </Modal>
    );
}
