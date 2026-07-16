import type React from "react";
import { useEffect, useRef } from "react";
import { ActionIcon, Box, CopyButton, ScrollArea, Text, Tooltip } from "@mantine/core";
import { observer } from "mobx-react-lite";

interface JobLogViewerProps {
    logs: string;
}

const NEAR_BOTTOM_THRESHOLD = 50;

export const JobLogViewer = observer(function JobLogViewer({
    logs
}: JobLogViewerProps): React.ReactNode {
    const viewportRef = useRef<HTMLDivElement>(null);
    const wasNearBottomRef = useRef(true);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !wasNearBottomRef.current) {
            return;
        }
        viewport.scrollTop = viewport.scrollHeight;
    }, [logs]);

    function handleScroll(position: { x: number; y: number }): void {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }
        const distanceFromBottom = viewport.scrollHeight - viewport.clientHeight - position.y;
        wasNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    }

    if (!logs) {
        return (
            <Box
                style={{
                    height: 300,
                    backgroundColor: "var(--mantine-color-dark-8)",
                    borderRadius: "var(--mantine-radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Text c="dimmed" size="sm" fs="italic">
                    Waiting for output...
                </Text>
            </Box>
        );
    }

    return (
        <Box pos="relative">
            <Box pos="absolute" top={8} right={8} style={{ zIndex: 1 }}>
                <CopyButton value={logs}>
                    {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy logs"} withArrow position="left">
                            <ActionIcon
                                variant="subtle"
                                color={copied ? "teal" : "gray"}
                                onClick={copy}
                                size="sm"
                            >
                                {copied ? "✓" : "⎘"}
                            </ActionIcon>
                        </Tooltip>
                    )}
                </CopyButton>
            </Box>
            <ScrollArea
                h={300}
                type="auto"
                viewportRef={viewportRef}
                onScrollPositionChange={handleScroll}
            >
                <Box
                    component="pre"
                    style={{
                        margin: 0,
                        padding: "var(--mantine-spacing-sm)",
                        backgroundColor: "var(--mantine-color-dark-8)",
                        color: "var(--mantine-color-gray-3)",
                        fontFamily: "monospace",
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        borderRadius: "var(--mantine-radius-sm)"
                    }}
                >
                    {logs}
                </Box>
            </ScrollArea>
        </Box>
    );
});
