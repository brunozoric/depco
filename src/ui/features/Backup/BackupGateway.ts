import { BackupGateway as Abstraction } from "./abstractions/BackupGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { exportBackupRoute, importBackupRoute } from "#shared/routes/index.js";

class BackupGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async exportBackup(): Promise<Abstraction.BackupPayload> {
        return this.httpClient.request(exportBackupRoute, {
            params: {}
        });
    }

    public async importBackup(
        payload: Abstraction.BackupPayload
    ): Promise<Abstraction.ImportResult> {
        return this.httpClient.request(importBackupRoute, {
            params: {},
            body: payload
        });
    }
}

export const BackupGateway = Abstraction.createImplementation({
    implementation: BackupGatewayImpl,
    dependencies: [HTTPClient]
});
