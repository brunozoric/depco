import type React from "react";
import { Alert, Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { formatFieldName } from "#ui/infrastructure/Shared/formatting/formatFieldName.js";

interface SecurityPanelProps {
    security: ProjectDetailPresenter.SecurityViewModel | null;
}

interface SecuritySetting {
    label: string;
    passed: boolean;
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
