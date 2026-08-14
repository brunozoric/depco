import type React from "react";
import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";

interface IRenameProjectModalProps {
    opened: boolean;
    currentName: string;
    onRename: (name: string) => Promise<void>;
    onClose: () => void;
}

export function RenameProjectModal({
    opened,
    currentName,
    onRename,
    onClose
}: IRenameProjectModalProps): React.ReactNode {
    const [name, setName] = useState(currentName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (): Promise<void> => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 100) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await onRename(trimmed);
            onClose();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Failed to rename");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Rename Project">
            <TextInput
                label="Project name"
                value={name}
                onChange={event => setName(event.currentTarget.value)}
                error={error}
                maxLength={100}
                onKeyDown={event => {
                    if (event.key === "Enter") {
                        void handleSubmit();
                    }
                }}
            />
            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    loading={loading}
                    disabled={!name.trim() || name.trim().length > 100}
                    onClick={() => void handleSubmit()}
                >
                    Save
                </Button>
            </Group>
        </Modal>
    );
}
