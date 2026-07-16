import { AppSettingsRepository as Abstraction } from "./abstractions/AppSettingsRepository.js";

class AppSettingsRepositoryImpl implements Abstraction.Interface {
    private settings: Abstraction.AppSetting[] = [];
    private configSource: "db" | "file" | "error" = "db";
    private fileManaged: string[] = [];
    private configError: Abstraction.ConfigError | null = null;
    private encryptionAvailable = false;

    public getSettings(): Abstraction.AppSetting[] {
        return this.settings;
    }

    public setSettings(settings: Abstraction.AppSetting[]): void {
        this.settings = settings;
    }

    public upsertSetting(setting: Abstraction.AppSetting): void {
        const index = this.settings.findIndex(s => s.key === setting.key);
        if (index >= 0) {
            this.settings = this.settings.map((s, i) => (i === index ? setting : s));
        } else {
            this.settings = [...this.settings, setting];
        }
    }

    public getConfigSource(): "db" | "file" | "error" {
        return this.configSource;
    }

    public setConfigSource(source: "db" | "file" | "error"): void {
        this.configSource = source;
    }

    public getFileManaged(): string[] {
        return this.fileManaged;
    }

    public setFileManaged(keys: string[]): void {
        this.fileManaged = keys;
    }

    public getConfigError(): Abstraction.ConfigError | null {
        return this.configError;
    }

    public setConfigError(error: Abstraction.ConfigError | null): void {
        this.configError = error;
    }

    public getEncryptionAvailable(): boolean {
        return this.encryptionAvailable;
    }

    public setEncryptionAvailable(available: boolean): void {
        this.encryptionAvailable = available;
    }
}

export const AppSettingsRepository = Abstraction.createImplementation({
    implementation: AppSettingsRepositoryImpl,
    dependencies: []
});
