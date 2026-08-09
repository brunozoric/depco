import type React from "react";
import { Alert, Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface SecurityPanelProps {
    security: ProjectDetailPresenter.SecurityViewModel | null;
}

interface SecuritySetting {
    label: string;
    passed: boolean;
}

const ACRONYMS = new Set(["npm", "pnpm", "yarn"]);

// Turns a camelCase check key (e.g. "npmPreapprovedPackages") into a
// human-readable label (e.g. "NPM Preapproved Packages"), upper-casing
// known package-manager acronyms along the way.
function formatFieldName(key: string): string {
    const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ");

    return words
        .filter(word => word.length > 0)
        .map(word => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) {
                return lower.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

export const SecurityPanel = observer(function SecurityPanel({
    security
}: SecurityPanelProps): React.ReactNode {
    if (!security) {
        return null;
    }

    const settings: SecuritySetting[] = Object.entries(security.checks).map(([key, passed]) => ({
        label: formatFieldName(key),
        passed
    }));

    return (
        <Card withBorder padding="md">
            <Stack gap="sm">
                <Title order={4}>Security</Title>
                <Group gap="lg">
                    {settings.map(setting => (
                        <Group key={setting.label} gap="xs">
                            <Text size="sm">{setting.label}</Text>
                            <Badge color={setting.passed ? "green" : "red"}>
                                {setting.passed ? "Pass" : "Fail"}
                            </Badge>
                        </Group>
                    ))}
                </Group>
                {!security.passes && (
                    <Alert color="red" title="Security check failed">
                        Security check failed — upgrades blocked
                    </Alert>
                )}
            </Stack>
        </Card>
    );
});
