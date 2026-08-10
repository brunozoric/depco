import type React from "react";
import { ActionIcon, Group, Stack, Text, Title } from "@mantine/core";

interface ProjectDetailHeaderProps {
    projectName: string;
    projectPath: string;
    packageManager: string | null;
    packageManagerVersion: string | null;
    loading: boolean;
    scanning: boolean;
    onBack: () => void;
    onRefresh: () => void;
}

export function ProjectDetailHeader({
    projectName,
    projectPath,
    packageManager,
    packageManagerVersion,
    loading,
    scanning,
    onBack,
    onRefresh
}: ProjectDetailHeaderProps): React.ReactNode {
    return (
        <>
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={onBack}>
                    &larr;
                </ActionIcon>
                <Title order={2}>{projectName}</Title>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    onClick={onRefresh}
                    loading={loading || scanning}
                >
                    &#x21bb;
                </ActionIcon>
            </Group>
            <Stack gap={4}>
                <Text c="dimmed" size="sm">
                    {projectPath}
                </Text>
                <Text size="sm">
                    {packageManager
                        ? `${packageManager.charAt(0).toUpperCase()}${packageManager.slice(1)} ${packageManagerVersion ?? ""}`.trim()
                        : `Package Manager: ${packageManagerVersion ?? "Unknown"}`}
                </Text>
            </Stack>
        </>
    );
}
