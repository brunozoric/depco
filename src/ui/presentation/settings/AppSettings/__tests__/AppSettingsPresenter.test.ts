import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { LoadAppSettingsUseCase } from "../../appSettingsUseCases/abstractions/LoadAppSettingsUseCase.js";
import { UpsertAppSettingUseCase } from "../../appSettingsUseCases/abstractions/UpsertAppSettingUseCase.js";
import { AppSettingsRepository } from "../../../../features/appSettings/abstractions/AppSettingsRepository.js";
import type { AppSettingsGateway } from "../../../../features/appSettings/abstractions/AppSettingsGateway.js";
import { AppSettingsPresenter } from "../abstractions/AppSettingsPresenter.js";
import { AppSettingsPresenter as AppSettingsPresenterRegistration } from "../AppSettingsPresenter.js";

describe("AppSettingsPresenter", () => {
    let storedSettings: AppSettingsGateway.AppSetting[];
    let storedConfigError: AppSettingsGateway.ConfigError | null;

    function createPresenter(): AppSettingsPresenter.Interface {
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {}
        });

        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async () => {}
        });

        container.registerInstance(AppSettingsRepository, {
            getSettings: () => storedSettings,
            setSettings: (settings: AppSettingsGateway.AppSetting[]) => {
                storedSettings = settings;
            },
            upsertSetting: (setting: AppSettingsGateway.AppSetting) => {
                const idx = storedSettings.findIndex(s => s.key === setting.key);
                if (idx >= 0) {
                    storedSettings[idx] = setting;
                } else {
                    storedSettings.push(setting);
                }
            },
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => storedConfigError,
            setConfigError: (error: AppSettingsGateway.ConfigError | null) => {
                storedConfigError = error;
            },
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });

        container.register(AppSettingsPresenterRegistration);

        return container.resolve(AppSettingsPresenter);
    }

    beforeEach(() => {
        storedSettings = [];
        storedConfigError = null;
    });

    it("vm.settings includes log_level with options array", () => {
        storedSettings = [{ key: "log_level", value: "warn" }];
        const presenter = createPresenter();

        const logLevel = presenter.vm.settings.find(s => s.key === "log_level");

        expect(logLevel).toBeDefined();
        expect(logLevel!.value).toBe("warn");
        expect(logLevel!.options).not.toBeNull();
        expect(logLevel!.options).toHaveLength(3);
    });

    it("vm.settings includes branch_template and commit_template without options", () => {
        storedSettings = [
            { key: "branch_template", value: "upgrade/${PROJECT}" },
            { key: "commit_template", value: "chore: upgrade ${PROJECT}" }
        ];
        const presenter = createPresenter();

        const branch = presenter.vm.settings.find(s => s.key === "branch_template");
        const commit = presenter.vm.settings.find(s => s.key === "commit_template");

        expect(branch).toBeDefined();
        expect(branch!.options).toBeNull();
        expect(branch!.label).toBe("Branch Name Template");

        expect(commit).toBeDefined();
        expect(commit!.options).toBeNull();
        expect(commit!.label).toBe("Commit Message Template");
    });

    it("log_level options have correct label and value pairs", () => {
        storedSettings = [{ key: "log_level", value: "error" }];
        const presenter = createPresenter();

        const logLevel = presenter.vm.settings.find(s => s.key === "log_level");

        expect(logLevel!.options).toEqual([
            { label: "Error", value: "error" },
            { label: "Warning", value: "warn" },
            { label: "Info", value: "info" }
        ]);
    });

    it("unknown settings from repository appear without options", () => {
        storedSettings = [{ key: "custom_flag", value: "true" }];
        const presenter = createPresenter();

        const custom = presenter.vm.settings.find(s => s.key === "custom_flag");

        expect(custom).toBeDefined();
        expect(custom!.value).toBe("true");
        expect(custom!.label).toBe("custom_flag");
        expect(custom!.description).toBe("");
        expect(custom!.options).toBeNull();
    });

    it("vm.configError is null when no error stored", () => {
        const presenter = createPresenter();
        expect(presenter.vm.configError).toBeNull();
    });

    it("vm.configError exposes stored error", () => {
        storedConfigError = { type: "json", message: "Unexpected token" };
        const presenter = createPresenter();
        expect(presenter.vm.configError).toEqual({ type: "json", message: "Unexpected token" });
    });

    it("vm defaults to not loading, no error, no editingKey", () => {
        const presenter = createPresenter();

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBeNull();
        expect(presenter.vm.editingKey).toBeNull();
    });

    it("vm.configSource reflects repository value", () => {
        const presenter = createPresenter();

        expect(presenter.vm.configSource).toBe("db");
    });

    it("vm.fileManaged reflects repository value", () => {
        const presenter = createPresenter();

        expect(presenter.vm.fileManaged).toEqual([]);
    });

    it("load calls loadUseCase.execute and sets loading back to false", async () => {
        let loadCalled = false;
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {
                loadCalled = true;
            }
        });
        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async () => {}
        });
        container.registerInstance(AppSettingsRepository, {
            getSettings: () => [],
            setSettings: () => {},
            upsertSetting: () => {},
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => null,
            setConfigError: () => {},
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });
        container.register(AppSettingsPresenterRegistration);

        const presenter = container.resolve(AppSettingsPresenter);
        await presenter.load();

        expect(loadCalled).toBe(true);
        expect(presenter.vm.loading).toBe(false);
    });

    it("startEdit sets editingKey", () => {
        const presenter = createPresenter();

        presenter.startEdit("branch_template");

        expect(presenter.vm.editingKey).toBe("branch_template");
    });

    it("cancelEdit clears editingKey", () => {
        const presenter = createPresenter();
        presenter.startEdit("branch_template");

        presenter.cancelEdit();

        expect(presenter.vm.editingKey).toBeNull();
    });

    it("confirmEdit calls upsertUseCase and clears editingKey", async () => {
        let upsertCalledWith: { key: string; value: string } | null = null;
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {}
        });
        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async (key: string, value: string) => {
                upsertCalledWith = { key, value };
            }
        });
        container.registerInstance(AppSettingsRepository, {
            getSettings: () => storedSettings,
            setSettings: (settings: AppSettingsGateway.AppSetting[]) => {
                storedSettings = settings;
            },
            upsertSetting: (setting: AppSettingsGateway.AppSetting) => {
                const idx = storedSettings.findIndex(s => s.key === setting.key);
                if (idx >= 0) {
                    storedSettings[idx] = setting;
                } else {
                    storedSettings.push(setting);
                }
            },
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => null,
            setConfigError: () => {},
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });
        container.register(AppSettingsPresenterRegistration);

        const presenter = container.resolve(AppSettingsPresenter);
        presenter.startEdit("log_level");
        await presenter.confirmEdit("info");

        expect(upsertCalledWith).toEqual({ key: "log_level", value: "info" });
        expect(presenter.vm.editingKey).toBeNull();
    });

    it("confirmEdit does nothing when editingKey is null", async () => {
        let upsertCalled = false;
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {}
        });
        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async () => {
                upsertCalled = true;
            }
        });
        container.registerInstance(AppSettingsRepository, {
            getSettings: () => [],
            setSettings: () => {},
            upsertSetting: () => {},
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => null,
            setConfigError: () => {},
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });
        container.register(AppSettingsPresenterRegistration);

        const presenter = container.resolve(AppSettingsPresenter);
        await presenter.confirmEdit("some-value");

        expect(upsertCalled).toBe(false);
    });

    it("confirmEdit sets error on failure and keeps editingKey", async () => {
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {}
        });
        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async () => {
                throw new Error("Save failed");
            }
        });
        container.registerInstance(AppSettingsRepository, {
            getSettings: () => [],
            setSettings: () => {},
            upsertSetting: () => {},
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => null,
            setConfigError: () => {},
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });
        container.register(AppSettingsPresenterRegistration);

        const presenter = container.resolve(AppSettingsPresenter);
        presenter.startEdit("branch_template");
        await presenter.confirmEdit("bad-value");

        expect(presenter.vm.error).toBe("Save failed");
        expect(presenter.vm.editingKey).toBe("branch_template");
    });

    it("confirmEdit sets fallback error for non-Error throws", async () => {
        const container: Container = createContainer();

        container.registerInstance(LoadAppSettingsUseCase, {
            execute: async () => {}
        });
        container.registerInstance(UpsertAppSettingUseCase, {
            execute: async () => {
                throw "string error";
            }
        });
        container.registerInstance(AppSettingsRepository, {
            getSettings: () => [],
            setSettings: () => {},
            upsertSetting: () => {},
            getConfigSource: () => "db" as const,
            setConfigSource: () => {},
            getFileManaged: () => [],
            setFileManaged: () => {},
            getConfigError: () => null,
            setConfigError: () => {},
            getEncryptionAvailable: () => false,
            setEncryptionAvailable: () => {}
        });
        container.register(AppSettingsPresenterRegistration);

        const presenter = container.resolve(AppSettingsPresenter);
        presenter.startEdit("log_level");
        await presenter.confirmEdit("invalid");

        expect(presenter.vm.error).toBe("Failed to save setting");
    });

    it("known settings show default empty value when not in repository", () => {
        storedSettings = [];
        const presenter = createPresenter();

        const branch = presenter.vm.settings.find(s => s.key === "branch_template");

        expect(branch).toBeDefined();
        expect(branch!.value).toBe("");
        expect(branch!.label).toBe("Branch Name Template");
    });

    it("known settings use descriptions from the meta registry", () => {
        storedSettings = [];
        const presenter = createPresenter();

        const logLevel = presenter.vm.settings.find(s => s.key === "log_level");

        expect(logLevel).toBeDefined();
        expect(logLevel!.description).toBe(
            "Minimum severity level for log entries. Lower levels capture more detail."
        );
    });
});
