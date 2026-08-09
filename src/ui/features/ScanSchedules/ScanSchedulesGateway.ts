import {
    listScanSchedulesRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute,
    getScanScheduleDefaultRoute,
    upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import { ScanSchedulesGateway as Abstraction } from "./abstractions/ScanSchedulesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";

class ScanSchedulesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(): Promise<Abstraction.ScheduleListResult> {
        const response = await this.httpClient.request(listScanSchedulesRoute, { params: {} });
        return { items: response.items, globalDefault: response.globalDefault };
    }

    public async upsert(projectId: string, interval: string): Promise<Abstraction.ScheduleRow> {
        const response = await this.httpClient.request(upsertScanScheduleRoute, {
            params: { projectId },
            body: { interval }
        });
        return response.item;
    }

    public async remove(projectId: string): Promise<void> {
        await this.httpClient.request(deleteScanScheduleRoute, { params: { projectId } });
    }

    public async getDefault(): Promise<string> {
        const response = await this.httpClient.request(getScanScheduleDefaultRoute, {
            params: {}
        });
        return response.item.interval;
    }

    public async setDefault(interval: string): Promise<string> {
        const response = await this.httpClient.request(upsertScanScheduleDefaultRoute, {
            params: {},
            body: { interval }
        });
        return response.item.interval;
    }
}

export const ScanSchedulesGateway = Abstraction.createImplementation({
    implementation: ScanSchedulesGatewayImpl,
    dependencies: [HTTPClient]
});
