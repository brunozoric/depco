import { makeAutoObservable, runInAction, computed } from "mobx";
import { AppSettingsPresenter as Abstraction } from "./abstractions/AppSettingsPresenter.js";
import { LoadAppSettingsUseCase } from "../appSettingsUseCases/abstractions/LoadAppSettingsUseCase.js";
import { UpsertAppSettingUseCase } from "../appSettingsUseCases/abstractions/UpsertAppSettingUseCase.js";
import { AppSettingsRepository } from "../../../features/AppSettings/abstractions/AppSettingsRepository.js";
import { getErrorMessage } from "#shared/errors.js";

interface IKnownSettingMeta {
    label: string;
    description: string;
    options?: Array<{ label: string; value: string }>;
}

const KNOWN_SETTINGS: Record<string, IKnownSettingMeta> = {
    branch_template: {
        label: "Branch Name Template",
        description: "Template for upgrade branch names. Tokens: ${PROJECT}, ${YYYY}, ${MM}, ${DD}"
    },
    commit_template: {
        label: "Commit Message Template",
        description:
            "Template for upgrade commit messages. Tokens: ${PROJECT}, ${BRANCH}, ${YYYY}, ${MM}, ${DD}"
    },
    log_level: {
        label: "Database Log Level",
        description:
            "Minimum severity for logs stored in the database and broadcast via WebSocket.",
        options: [
            { label: "Trace", value: "trace" },
            { label: "Debug", value: "debug" },
            { label: "Info", value: "info" },
            { label: "Warning", value: "warn" },
            { label: "Error", value: "error" },
            { label: "Fatal", value: "fatal" }
        ]
    },
    console_log_level: {
        label: "Console Log Level",
        description: "Minimum severity for log output in the server console. Requires restart.",
        options: [
            { label: "Trace", value: "trace" },
            { label: "Debug", value: "debug" },
            { label: "Info", value: "info" },
            { label: "Warning", value: "warn" },
            { label: "Error", value: "error" },
            { label: "Fatal", value: "fatal" }
        ]
    },
    file_log_level: {
        label: "File Log Level",
        description:
            "Minimum severity for log entries written to the rotating file (data/app.log). Requires restart.",
        options: [
            { label: "Trace", value: "trace" },
            { label: "Debug", value: "debug" },
            { label: "Info", value: "info" },
            { label: "Warning", value: "warn" },
            { label: "Error", value: "error" },
            { label: "Fatal", value: "fatal" }
        ]
    },
    github_token: {
        label: "GitHub Token",
        description: "Managed in Pull Requests section below."
    },
    gitlab_token: {
        label: "GitLab Token",
        description: "Managed in Pull Requests section below."
    },
    pr_title_template: {
        label: "PR Title Template",
        description: "Managed in Pull Requests section below."
    },
    pr_body_template: {
        label: "PR Body Template",
        description: "Managed in Pull Requests section below."
    },
    snooze_check_interval: {
        label: "Snooze Check Interval",
        description:
            "How often the server checks for expired vulnerability snoozes (milliseconds). Requires restart.",
        options: [
            { label: "15 minutes", value: "900000" },
            { label: "30 minutes", value: "1800000" },
            { label: "1 hour", value: "3600000" },
            { label: "4 hours", value: "14400000" }
        ]
    },
    "transitive-resolve-ttl": {
        label: "Transitive Dep Cache TTL",
        description:
            "Hours between re-checking transitive dependency versions. 0 disables re-resolution.",
        options: [
            { label: "Disabled", value: "0" },
            { label: "12 hours", value: "12" },
            { label: "24 hours", value: "24" },
            { label: "3 days", value: "72" },
            { label: "7 days", value: "168" }
        ]
    }
};

class AppSettingsPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private editingKey: string | null = null;

    public constructor(
        private readonly loadUseCase: LoadAppSettingsUseCase.Interface,
        private readonly upsertUseCase: UpsertAppSettingUseCase.Interface,
        private readonly repository: AppSettingsRepository.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        const stored = this.repository.getSettings();
        const settings: Abstraction.SettingViewModel[] = [];

        for (const [key, meta] of Object.entries(KNOWN_SETTINGS)) {
            const existing = stored.find(s => s.key === key);
            settings.push({
                key,
                value: existing?.value ?? "",
                label: meta.label,
                description: meta.description,
                options: meta.options ?? null
            });
        }

        for (const setting of stored) {
            if (KNOWN_SETTINGS[setting.key]) {
                continue;
            }
            settings.push({
                key: setting.key,
                value: setting.value,
                label: setting.key,
                description: "",
                options: null
            });
        }

        return {
            loading: this.loading,
            error: this.error,
            settings,
            editingKey: this.editingKey,
            configSource: this.repository.getConfigSource(),
            fileManaged: this.repository.getFileManaged(),
            configError: this.repository.getConfigError()
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await this.loadUseCase.execute();
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public startEdit = (key: string): void => {
        this.editingKey = key;
    };

    public confirmEdit = async (value: string): Promise<void> => {
        if (!this.editingKey) {
            return;
        }

        this.error = null;
        const key = this.editingKey;

        try {
            await this.upsertUseCase.execute(key, value);
            runInAction(() => {
                this.editingKey = null;
            });
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to save setting");
            });
        }
    };

    public cancelEdit = (): void => {
        this.editingKey = null;
    };
}

export const AppSettingsPresenter = Abstraction.createImplementation({
    implementation: AppSettingsPresenterImpl,
    dependencies: [LoadAppSettingsUseCase, UpsertAppSettingUseCase, AppSettingsRepository]
});
