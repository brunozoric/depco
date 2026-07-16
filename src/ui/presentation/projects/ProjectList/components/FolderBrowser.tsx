import type React from "react";
import {
    Anchor,
    Breadcrumbs,
    Checkbox,
    Group,
    ScrollArea,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";

interface FolderBrowserProps {
    currentPath: string;
    items: ProjectListPresenter.BrowseItem[];
    onNavigate: (path: string) => void;
    loading: boolean;
    selected?: Set<string>;
    onToggle?: (path: string) => void;
}

export function FolderBrowser({
    currentPath,
    items,
    onNavigate,
    loading,
    selected,
    onToggle
}: FolderBrowserProps): React.ReactNode {
    const segments = currentPath.split("/").filter(Boolean);
    const selectable = selected !== undefined && onToggle !== undefined;

    return (
        <Stack gap="xs">
            <Breadcrumbs>
                <Anchor onClick={() => onNavigate("/")} size="sm">
                    /
                </Anchor>
                {segments.map((segment, index) => {
                    const segmentPath = "/" + segments.slice(0, index + 1).join("/");
                    return (
                        <Anchor key={segmentPath} onClick={() => onNavigate(segmentPath)} size="sm">
                            {segment}
                        </Anchor>
                    );
                })}
            </Breadcrumbs>
            <ScrollArea h={200} style={{ border: "1px solid var(--mantine-color-default-border)" }}>
                {loading ? (
                    <Text size="sm" c="dimmed" p="xs">
                        Loading...
                    </Text>
                ) : items.length === 0 ? (
                    <Text size="sm" c="dimmed" p="xs">
                        Empty directory
                    </Text>
                ) : (
                    <Stack gap={2} p={2}>
                        {items.map(item => {
                            const isSelected = selectable && selected.has(item.path);
                            return (
                                <Group
                                    key={item.path}
                                    gap={0}
                                    wrap="nowrap"
                                    style={
                                        isSelected
                                            ? {
                                                  backgroundColor:
                                                      "var(--mantine-color-blue-light)",
                                                  borderRadius: 4
                                              }
                                            : undefined
                                    }
                                >
                                    {selectable && (
                                        <Checkbox
                                            size="xs"
                                            ml="xs"
                                            checked={selected.has(item.path)}
                                            onChange={() => onToggle(item.path)}
                                        />
                                    )}
                                    <UnstyledButton
                                        onClick={() => onNavigate(item.path)}
                                        p="xs"
                                        style={{ borderRadius: 4, flex: 1 }}
                                    >
                                        <Group gap="xs">
                                            <Text size="sm">{item.name}</Text>
                                        </Group>
                                    </UnstyledButton>
                                </Group>
                            );
                        })}
                    </Stack>
                )}
            </ScrollArea>
        </Stack>
    );
}
