import { AppSettingsGateway as Abstraction } from "./abstractions/AppSettingsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";

class AppSettingsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(): Promise<Abstraction.ListResult> {
        const response = await this.httpClient.request(listAppSettingsRoute, {
            params: {},
            query: {}
        });
        return {
            settings: response.items,
            configSource: response.configSource,
            fileManaged: response.fileManaged,
            ...(response.configError ? { configError: response.configError } : {})
        };
    }

    public async upsert(key: string, value: string): Promise<Abstraction.AppSetting> {
        const response = await this.httpClient.request(upsertAppSettingRoute, {
            params: { key },
            body: { value }
        });
        return response.item;
    }
}

export const AppSettingsGateway = Abstraction.createImplementation({
    implementation: AppSettingsGatewayImpl,
    dependencies: [HTTPClient]
});
