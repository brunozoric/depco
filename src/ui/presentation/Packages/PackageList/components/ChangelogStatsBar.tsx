import type React from "react";
import { Group, Badge } from "@mantine/core";
import type { ChangelogsGateway } from "#ui/features/Changelogs/abstractions/ChangelogsGateway.js";

interface ChangelogStatsBarProps {
    stats: ChangelogsGateway.Stats | null;
}

export function ChangelogStatsBar({ stats }: ChangelogStatsBarProps): React.ReactNode {
    if (!stats || stats.total === 0) {
        return null;
    }

    return (
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
    );
}
