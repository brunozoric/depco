import { PmSettingsGateway as Abstraction } from "./abstractions/PmSettingsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    listSecuritySettingsRoute,
    createSecuritySettingRoute,
    updateSecuritySettingRoute,
    toggleSecuritySettingRoute,
    resetSecuritySettingsRoute,
    listPmSettingsRoute,
    updatePmConfigRoute
} from "#shared/routes/index.js";

class PmSettingsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(): Promise<Abstraction.ListResult> {
        const response = await this.httpClient.request(listSecuritySettingsRoute, { params: {} });
        return {
            settings: response.items,
            configSource: response.configSource,
            fileManagedPms: response.fileManagedPms,
            ...(response.configError ? { configError: response.configError } : {})
        };
    }

    public async create(
        packageManager: string,
        fieldName: string,
        expectedValue: string
    ): Promise<Abstraction.SecuritySetting> {
        const response = await this.httpClient.request(createSecuritySettingRoute, {
            params: {},
            body: { packageManager, fieldName, expectedValue }
        });
        return response.item;
    }

    public async update(id: string, expectedValue: string): Promise<Abstraction.SecuritySetting> {
        const response = await this.httpClient.request(updateSecuritySettingRoute, {
            params: { id },
            body: { expectedValue }
        });
        return response.item;
    }

    public async toggle(id: string): Promise<Abstraction.SecuritySetting> {
        const response = await this.httpClient.request(toggleSecuritySettingRoute, {
            params: { id }
        });
        return response.item;
    }

    public async resetDefaults(packageManager: string): Promise<Abstraction.SecuritySetting[]> {
        const response = await this.httpClient.request(resetSecuritySettingsRoute, {
            params: {},
            body: { packageManager }
        });
        return response.items;
    }

    public async listPmConfig(): Promise<Abstraction.PmConfigListResult> {
        const response = await this.httpClient.request(listPmSettingsRoute, { params: {} });
        return {
            items: response.items,
            configSource: response.configSource,
            fileManagedPms: response.fileManagedPms,
            ...(response.configError ? { configError: response.configError } : {})
        };
    }

    public async updatePmConfig(
        pm: string,
        settings: Abstraction.UpdatePmConfigBody
    ): Promise<Abstraction.PmConfigItem> {
        const response = await this.httpClient.request(updatePmConfigRoute, {
            params: { pm: pm as "yarn" | "npm" | "pnpm" | "bun" },
            body: settings
        });
        return response.item;
    }
}

export const PmSettingsGateway = Abstraction.createImplementation({
    implementation: PmSettingsGatewayImpl,
    dependencies: [HTTPClient]
});
