import type React from "react";
import { Button, Group, Modal, Text } from "@mantine/core";

interface ConfirmDialogProps {
    opened: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    opened,
    title,
    message,
    confirmLabel = "Confirm",
    confirmColor = "red",
    onConfirm,
    onCancel
}: ConfirmDialogProps): React.ReactNode {
    return (
        <Modal opened={opened} onClose={onCancel} title={title} centered size="sm">
            <Text size="sm" mb="lg">
                {message}
            </Text>
            <Group justify="flex-end" gap="sm">
                <Button variant="subtle" onClick={onCancel}>
                    Cancel
                </Button>
                <Button color={confirmColor} onClick={onConfirm}>
                    {confirmLabel}
                </Button>
            </Group>
        </Modal>
    );
}
