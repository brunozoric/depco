import type React from "react";
import { useEffect, useState } from "react";
import { Alert, PasswordInput, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { useContainer } from "../../../../shared/di/ContainerProvider.js";
import { AppSettingsGateway } from "../../../../features/AppSettings/abstractions/AppSettingsGateway.js";
import { AppSettingsRepository } from "../../../../features/AppSettings/abstractions/AppSettingsRepository.js";

interface IPrSettings {
    githubToken: string;
    gitlabToken: string;
    prTitleTemplate: string;
    prBodyTemplate: string;
}

const SETTING_KEYS = {
    githubToken: "github_token",
    gitlabToken: "gitlab_token",
    prTitleTemplate: "pr_title_template",
    prBodyTemplate: "pr_body_template"
} as const;

const EMPTY_SETTINGS: IPrSettings = {
    githubToken: "",
    gitlabToken: "",
    prTitleTemplate: "",
    prBodyTemplate: ""
};

export function PrSettingsSection(): React.ReactNode {
    const container = useContainer();
    const gateway = container.resolve(AppSettingsGateway);
    const repository = container.resolve(AppSettingsRepository);

    const [settings, setSettings] = useState<IPrSettings>(EMPTY_SETTINGS);
    const [encryptionAvailable, setEncryptionAvailable] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void gateway.list().then(result => {
            if (cancelled) {
                return;
            }
            repository.setSettings(result.settings);
            setEncryptionAvailable(result.encryptionAvailable ?? false);
            const get = (key: string): string =>
                result.settings.find(s => s.key === key)?.value ?? "";

            setSettings({
                githubToken: get(SETTING_KEYS.githubToken),
                gitlabToken: get(SETTING_KEYS.gitlabToken),
                prTitleTemplate: get(SETTING_KEYS.prTitleTemplate),
                prBodyTemplate: get(SETTING_KEYS.prBodyTemplate)
            });
        });

        return () => {
            cancelled = true;
        };
    }, [gateway, repository]);

    const save = async (key: string, value: string): Promise<void> => {
        const setting = await gateway.upsert(key, value);
        repository.upsertSetting(setting);
    };

    return (
        <Stack gap="md">
            <Text fw={600} size="sm">
                Pull Requests
            </Text>

            {!encryptionAvailable && (
                <Alert color="red" title="Encryption Unavailable">
                    ENCRYPTION_KEY is not configured. Token storage is disabled. Set ENCRYPTION_KEY
                    in your .env file and restart the server.
                </Alert>
            )}

            <PasswordInput
                label="GitHub Token"
                description="Personal access token for creating pull requests on GitHub"
                value={settings.githubToken}
                onChange={event =>
                    setSettings(prev => ({ ...prev, githubToken: event.currentTarget.value }))
                }
                onBlur={() => void save(SETTING_KEYS.githubToken, settings.githubToken)}
                disabled={!encryptionAvailable}
            />

            <PasswordInput
                label="GitLab Token"
                description="Personal access token for creating merge requests on GitLab"
                value={settings.gitlabToken}
                onChange={event =>
                    setSettings(prev => ({ ...prev, gitlabToken: event.currentTarget.value }))
                }
                onBlur={() => void save(SETTING_KEYS.gitlabToken, settings.gitlabToken)}
                disabled={!encryptionAvailable}
            />

            <TextInput
                label="PR Title Template"
                description="Tokens: ${COUNT}, ${PROJECT}, ${YYYY}, ${MM}, ${DD}"
                placeholder="chore(deps): upgrade ${COUNT} packages"
                value={settings.prTitleTemplate}
                onChange={event =>
                    setSettings(prev => ({ ...prev, prTitleTemplate: event.currentTarget.value }))
                }
                onBlur={() => void save(SETTING_KEYS.prTitleTemplate, settings.prTitleTemplate)}
            />

            <Textarea
                label="PR Body Template"
                description="Tokens: ${PACKAGES_TABLE}, ${COUNT}, ${PROJECT}, ${YYYY}, ${MM}, ${DD}"
                placeholder="## Dependency Upgrades&#10;&#10;${PACKAGES_TABLE}"
                value={settings.prBodyTemplate}
                onChange={event =>
                    setSettings(prev => ({ ...prev, prBodyTemplate: event.currentTarget.value }))
                }
                onBlur={() => void save(SETTING_KEYS.prBodyTemplate, settings.prBodyTemplate)}
                minRows={4}
                autosize
            />
        </Stack>
    );
}
