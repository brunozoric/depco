import { computed, makeAutoObservable, runInAction } from "mobx";
import { PmSettingsPresenter as Abstraction } from "./abstractions/PmSettingsPresenter.js";
import { LoadSecuritySettingsUseCase } from "../useCases/abstractions/LoadSecuritySettingsUseCase.js";
import { LoadPmConfigUseCase } from "../useCases/abstractions/LoadPmConfigUseCase.js";
import { CreateSecuritySettingUseCase } from "../useCases/abstractions/CreateSecuritySettingUseCase.js";
import { UpdateSecuritySettingUseCase } from "../useCases/abstractions/UpdateSecuritySettingUseCase.js";
import { ToggleSecuritySettingUseCase } from "../useCases/abstractions/ToggleSecuritySettingUseCase.js";
import { ResetSecuritySettingsUseCase } from "../useCases/abstractions/ResetSecuritySettingsUseCase.js";
import { PmSettingsRepository } from "../../../features/settings/abstractions/PmSettingsRepository.js";
import type { PmSettingsGateway } from "../../../features/settings/abstractions/PmSettingsGateway.js";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";
import { SavePmConfigUseCase } from "../useCases/abstractions/SavePmConfigUseCase.js";
import { notifications } from "@mantine/notifications";

class PmSettingsPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private selectedPm: PackageManagerId = "yarn";
    private editingId: string | null = null;
    private addingField: string | null = null;
    private settings: PmSettingsGateway.SecuritySetting[] = [];
    private pmConfigs: PmSettingsGateway.PmConfigItem[] = [];
    private activeTab: Abstraction.TabId = "security";
    private pendingChanges: PmSettingsGateway.UpdatePmConfigBody | null = null;
    private pendingDescription = "";
    private saving = false;

    public constructor(
        private readonly loadUseCase: LoadSecuritySettingsUseCase.Interface,
        private readonly loadPmConfigUseCase: LoadPmConfigUseCase.Interface,
        private readonly createUseCase: CreateSecuritySettingUseCase.Interface,
        private readonly updateUseCase: UpdateSecuritySettingUseCase.Interface,
        private readonly toggleUseCase: ToggleSecuritySettingUseCase.Interface,
        private readonly resetUseCase: ResetSecuritySettingsUseCase.Interface,
        private readonly repository: PmSettingsRepository.Interface,
        private readonly saveUseCase: SavePmConfigUseCase.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    private syncFromRepository = (): void => {
        this.settings = this.repository.getSettings();
        this.pmConfigs = this.repository.getPmConfigs();
    };

    public get vm(): Abstraction.ViewModel {
        const pmSettings = this.settings.filter(s => s.packageManager === this.selectedPm);
        const registry = SECURITY_FIELD_REGISTRY[this.selectedPm];
        const usedFields = new Set(pmSettings.map(s => s.fieldName));
        const fileManagedPms = this.repository.getFileManagedPms();

        const viewSettings: Abstraction.SettingViewModel[] = pmSettings.map(s => {
            const def = registry.find(f => f.fieldName === s.fieldName);
            return {
                id: s.id,
                fieldName: s.fieldName,
                configFile: s.configFile,
                description: def?.description ?? s.fieldName,
                expectedValue: s.expectedValue,
                enabled: s.enabled,
                isOrphaned: !def,
                helperText: def?.helperText ?? "",
                inputType: def?.inputType ?? "duration",
                isFileManaged: fileManagedPms.includes(s.packageManager)
            };
        });

        const availableFields: Abstraction.AvailableFieldViewModel[] = registry
            .filter(f => !usedFields.has(f.fieldName))
            .map(f => ({
                fieldName: f.fieldName,
                configFile: f.configFile,
                description: f.description,
                defaultExpectedValue: f.defaultExpectedValue,
                helperText: f.helperText,
                inputType: f.inputType
            }));

        const pmConfig = this.pmConfigs.find(c => c.packageManager === this.selectedPm);

        const installFlags: Abstraction.InstallFlagViewModel[] = pmConfig
            ? pmConfig.installFlags.map(flag => ({
                  flag: flag.flag,
                  label: flag.label,
                  description: flag.description,
                  enabled: flag.enabled,
                  defaultEnabled: flag.defaultEnabled,
                  isFileManaged: flag.isFileManaged
              }))
            : [];

        const generalSettings: Abstraction.GeneralSettingsViewModel = {
            registryUrl: pmConfig?.general.registryUrl ?? null,
            upgradeStrategy: pmConfig?.general.upgradeStrategy ?? null
        };

        return {
            loading: this.loading,
            error: this.error,
            selectedPackageManager: this.selectedPm,
            settings: viewSettings,
            availableFields,
            editingId: this.editingId,
            addingField: this.addingField,
            canReset: registry.length > 0,
            configSource: this.repository.getConfigSource(),
            fileManagedPms,
            configError: this.repository.getConfigError(),
            activeTab: this.activeTab,
            installFlags,
            generalSettings,
            confirmDialog: this.pendingChanges
                ? {
                      description: this.pendingDescription,
                      changes: this.pendingChanges as Record<string, unknown>
                  }
                : null,
            saving: this.saving
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        try {
            await Promise.all([this.loadUseCase.execute(), this.loadPmConfigUseCase.execute()]);
            runInAction(() => {
                this.syncFromRepository();
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public selectPackageManager = (pm: PackageManagerId): void => {
        this.selectedPm = pm;
        this.editingId = null;
        this.addingField = null;
        this.error = null;
    };

    public startAdd = (fieldName: string): void => {
        this.editingId = null;
        this.addingField = fieldName;
    };

    public confirmAdd = async (expectedValue: string): Promise<void> => {
        if (!this.addingField) {
            return;
        }

        this.error = null;
        const fieldName = this.addingField;

        try {
            await this.createUseCase.execute(this.selectedPm, fieldName, expectedValue);
            runInAction(() => {
                this.addingField = null;
                this.syncFromRepository();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to create setting";
            });
        }
    };

    public cancelAdd = (): void => {
        this.addingField = null;
    };

    public startEdit = (id: string): void => {
        this.addingField = null;
        this.editingId = id;
    };

    public confirmEdit = async (expectedValue: string): Promise<void> => {
        if (!this.editingId) {
            return;
        }

        this.error = null;
        const id = this.editingId;

        try {
            await this.updateUseCase.execute(id, expectedValue);
            runInAction(() => {
                this.editingId = null;
                this.syncFromRepository();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to update setting";
            });
        }
    };

    public cancelEdit = (): void => {
        this.editingId = null;
    };

    public setActiveTab = (tab: Abstraction.TabId): void => {
        this.activeTab = tab;
    };

    public toggle = async (id: string): Promise<void> => {
        this.error = null;
        try {
            await this.toggleUseCase.execute(id);
            runInAction(() => {
                this.syncFromRepository();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to toggle setting";
            });
        }
    };

    public resetToDefaults = async (): Promise<void> => {
        this.error = null;
        this.editingId = null;
        this.addingField = null;
        this.loading = true;
        try {
            await this.resetUseCase.execute(this.selectedPm);
            runInAction(() => {
                this.syncFromRepository();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to reset settings";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public toggleInstallFlag = (flag: string): void => {
        const pmConfig = this.pmConfigs.find(c => c.packageManager === this.selectedPm);
        if (!pmConfig) {
            return;
        }
        const currentFlag = pmConfig.installFlags.find(f => f.flag === flag);
        if (!currentFlag) {
            return;
        }
        const allFlags: Record<string, boolean> = {};
        for (const f of pmConfig.installFlags) {
            allFlags[f.flag] = f.flag === flag ? !f.enabled : f.enabled;
        }
        this.pendingChanges = { installFlags: allFlags };
        this.pendingDescription = `Toggle ${flag} to ${!currentFlag.enabled ? "enabled" : "disabled"}`;
    };

    public saveRegistryUrl = (url: string): void => {
        this.pendingChanges = { registryUrl: url };
        this.pendingDescription = url ? `Set registry URL to ${url}` : "Clear registry URL";
    };

    public saveUpgradeStrategy = (strategy: string): void => {
        this.pendingChanges = {
            upgradeStrategy: strategy as "caret" | "tilde" | "exact" | "latest" | ""
        };
        this.pendingDescription = strategy
            ? `Set upgrade strategy to ${strategy}`
            : "Clear upgrade strategy";
    };

    public confirmSave = async (): Promise<void> => {
        if (!this.pendingChanges) {
            return;
        }
        this.saving = true;
        const changes = this.pendingChanges;
        try {
            await this.saveUseCase.execute(this.selectedPm, changes);
            runInAction(() => {
                this.pendingChanges = null;
                this.pendingDescription = "";
                this.syncFromRepository();
            });
        } catch (err) {
            runInAction(() => {
                this.pendingChanges = null;
                this.pendingDescription = "";
                notifications.show({
                    color: "red",
                    title: "Save failed",
                    message: err instanceof Error ? err.message : "Failed to save PM settings",
                    autoClose: 5000
                });
            });
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    };

    public cancelSave = (): void => {
        this.pendingChanges = null;
        this.pendingDescription = "";
    };
}

export const PmSettingsPresenter = Abstraction.createImplementation({
    implementation: PmSettingsPresenterImpl,
    dependencies: [
        LoadSecuritySettingsUseCase,
        LoadPmConfigUseCase,
        CreateSecuritySettingUseCase,
        UpdateSecuritySettingUseCase,
        ToggleSecuritySettingUseCase,
        ResetSecuritySettingsUseCase,
        PmSettingsRepository,
        SavePmConfigUseCase
    ]
});
