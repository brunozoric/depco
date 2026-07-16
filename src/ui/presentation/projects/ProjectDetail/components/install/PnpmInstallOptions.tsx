import type React from "react";
import { Stack, Switch, Text } from "@mantine/core";
import type { InstallOptionsProps } from "./registry.js";

export function PnpmInstallOptions({
    flags,
    selected,
    onToggle
}: InstallOptionsProps): React.ReactNode {
    return (
        <Stack gap="xs">
            {flags.map(flag => (
                <Switch
                    key={flag.flag}
                    label={flag.label}
                    description={flag.description}
                    checked={selected.includes(flag.flag)}
                    onChange={() => onToggle(flag.flag)}
                />
            ))}
            {flags.length === 0 && (
                <Text size="sm" c="dimmed">
                    No options available
                </Text>
            )}
        </Stack>
    );
}
