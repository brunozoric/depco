import type React from "react";
import { useState, useEffect } from "react";
import { Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { INSTALL_OPTIONS_COMPONENTS } from "./install/index.js";

export interface InstallDialogProject {
    name: string;
    packageManager: string | null;
}

interface InstallDialogProps {
    opened: boolean;
    onClose: () => void;
    project: InstallDialogProject;
    getInstallOptions: (pm: string) => Promise<IInstallFlagDefinition[]>;
    onInstall: (flags: string[]) => Promise<void>;
}

export function InstallDialog({
    opened,
    onClose,
    project,
    getInstallOptions,
    onInstall
}: InstallDialogProps): React.ReactNode {
    const [flags, setFlags] = useState<IInstallFlagDefinition[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (opened && project.packageManager) {
            setLoading(true);
            setSelected([]);
            getInstallOptions(project.packageManager)
                .then(items => {
                    setFlags(items);
                    setLoading(false);
                })
                .catch(() => {
                    setFlags([]);
                    setLoading(false);
                });
        }
    }, [opened, project.packageManager, getInstallOptions]);

    const handleToggle = (flag: string): void => {
        setSelected(prev => (prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]));
    };

    const handleInstall = async (): Promise<void> => {
        setInstalling(true);
        try {
            await onInstall(selected);
            onClose();
        } finally {
            setInstalling(false);
        }
    };

    const pm = project.packageManager as PackageManagerId | null;
    const OptionsComponent = pm ? INSTALL_OPTIONS_COMPONENTS[pm] : null;

    return (
        <Modal opened={opened} onClose={onClose} title={`Install — ${project.name}`} size="md">
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    Package manager: {project.packageManager ?? "Unknown"}
                </Text>

                {loading ? (
                    <Loader size="sm" />
                ) : OptionsComponent ? (
                    <OptionsComponent flags={flags} selected={selected} onToggle={handleToggle} />
                ) : (
                    <Text size="sm" c="dimmed">
                        No options available for this package manager
                    </Text>
                )}

                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleInstall} loading={installing}>
                        Install
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
