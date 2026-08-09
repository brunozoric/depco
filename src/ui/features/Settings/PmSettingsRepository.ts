import { PmSettingsRepository as Abstraction } from "./abstractions/PmSettingsRepository.js";

class PmSettingsRepositoryImpl implements Abstraction.Interface {
    private settings: Abstraction.SecuritySetting[] = [];
    private configSource: "db" | "file" | "error" = "db";
    private fileManagedPms: string[] = [];
    private configError: Abstraction.ConfigError | null = null;
    private pmConfigs: Abstraction.PmConfigItem[] = [];

    public getSettings(): Abstraction.SecuritySetting[] {
        return this.settings;
    }

    public setSettings(settings: Abstraction.SecuritySetting[]): void {
        this.settings = settings;
    }

    public addSetting(setting: Abstraction.SecuritySetting): void {
        this.settings = [...this.settings, setting];
    }

    public updateSetting(id: string, expectedValue: string): void {
        this.settings = this.settings.map(s => (s.id === id ? { ...s, expectedValue } : s));
    }

    public updateSettingFromServer(id: string, setting: Abstraction.SecuritySetting): void {
        this.settings = this.settings.map(s => (s.id === id ? setting : s));
    }

    public toggleSetting(id: string): void {
        this.settings = this.settings.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    }

    public getConfigSource(): "db" | "file" | "error" {
        return this.configSource;
    }

    public setConfigSource(source: "db" | "file" | "error"): void {
        this.configSource = source;
    }

    public getFileManagedPms(): string[] {
        return this.fileManagedPms;
    }

    public setFileManagedPms(pms: string[]): void {
        this.fileManagedPms = pms;
    }

    public getConfigError(): Abstraction.ConfigError | null {
        return this.configError;
    }

    public setConfigError(error: Abstraction.ConfigError | null): void {
        this.configError = error;
    }

    public getPmConfigs(): Abstraction.PmConfigItem[] {
        return this.pmConfigs;
    }

    public setPmConfigs(items: Abstraction.PmConfigItem[]): void {
        this.pmConfigs = items;
    }
}

export const PmSettingsRepository = Abstraction.createImplementation({
    implementation: PmSettingsRepositoryImpl,
    dependencies: []
});
