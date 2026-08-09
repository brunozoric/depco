import type React from "react";
import { useEffect, useState } from "react";
import { Accordion, Badge, Button, Drawer, Group, Loader, Stack, Text } from "@mantine/core";
import Markdown from "react-markdown";
import type { ProjectDetailPresenter } from "../../ProjectDetail/abstractions/ProjectDetailPresenter.js";
import type { IChangelogTrackingState } from "../../../Shared/ChangelogTracker.js";
import type { IStartChangelogTrackingInput } from "../../../Shared/ChangelogTracker.js";

export interface ChangelogDrawerTarget {
    packageName: string;
    currentVersion: string;
    latestVersion: string;
}

interface ChangelogDrawerProps {
    target: ChangelogDrawerTarget | null;
    onClose: () => void;
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

export function ChangelogDrawer({
    target,
    onClose,
    getChangelogs,
    onRefresh,
    changelogState,
    onStartTracking
}: ChangelogDrawerProps): React.ReactNode {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    function handleRefresh(): void {
        if (!onRefresh || !target) {
            return;
        }
        setRefreshing(true);
        onRefresh(target.packageName, target.currentVersion, target.latestVersion)
            .then(result => {
                onStartTracking({
                    packageName: target.packageName,
                    entries: result.entries.reverse(),
                    resolving: result.resolving
                });
                setRefreshing(false);
            })
            .catch(() => {
                setRefreshing(false);
            });
    }

    useEffect(() => {
        if (!target) {
            return;
        }

        let cancelled = false;
        setLoading(true);
        getChangelogs(target.packageName, target.currentVersion, target.latestVersion)
            .then(result => {
                if (cancelled) {
                    return;
                }
                onStartTracking({
                    packageName: target.packageName,
                    entries: result.entries.reverse(),
                    resolving: result.resolving
                });
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [target, getChangelogs, onStartTracking]);

    const entries = changelogState?.entries ?? [];
    const resolving = changelogState?.resolving ?? false;
    const resolvedCount = changelogState?.resolvedCount ?? 0;
    const totalToResolve = changelogState?.totalToResolve ?? 0;

    return (
        <Drawer
            opened={target !== null}
            onClose={onClose}
            position="right"
            size="lg"
            title={target ? `Changelog — ${target.packageName}` : ""}
        >
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
        </Drawer>
    );
}
