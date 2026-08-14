import type React from "react";
import { useState } from "react";
import { ActionIcon, Group, Stack, Text, TextInput, Title } from "@mantine/core";

interface IProjectDetailHeaderProps {
    projectName: string;
    projectPath: string;
    packageManager: string | null;
    packageManagerVersion: string | null;
    loading: boolean;
    scanning: boolean;
    onBack: () => void;
    onRefresh: () => void;
    onRename?: (name: string) => Promise<void>;
}

export function ProjectDetailHeader({
    projectName,
    projectPath,
    packageManager,
    packageManagerVersion,
    loading,
    scanning,
    onBack,
    onRefresh,
    onRename
}: IProjectDetailHeaderProps): React.ReactNode {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(projectName);

    const handleSave = async (): Promise<void> => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === projectName || !onRename) {
            setEditing(false);
            setEditValue(projectName);
            return;
        }
        try {
            await onRename(trimmed);
            setEditing(false);
        } catch {
            setEditValue(projectName);
            setEditing(false);
        }
    };

    return (
        <>
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={onBack}>
                    &larr;
                </ActionIcon>
                {editing ? (
                    <TextInput
                        value={editValue}
                        onChange={event => setEditValue(event.currentTarget.value)}
                        onBlur={() => void handleSave()}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                void handleSave();
                            }
                            if (event.key === "Escape") {
                                setEditing(false);
                                setEditValue(projectName);
                            }
                        }}
                        autoFocus
                        maxLength={100}
                        size="lg"
                    />
                ) : (
                    <Title
                        order={2}
                        style={{ cursor: onRename ? "pointer" : "default" }}
                        onClick={() => {
                            if (onRename) {
                                setEditing(true);
                                setEditValue(projectName);
                            }
                        }}
                    >
                        {projectName}
                    </Title>
                )}
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
