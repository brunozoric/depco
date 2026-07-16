import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { exportBackupRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { BackupGateway } from "../../../../features/backup/abstractions/BackupGateway.js";
import { BackupGateway as BackupGatewayRegistration } from "../../../../features/backup/BackupGateway.js";
import { ExportBackupUseCase } from "../abstractions/ExportBackupUseCase.js";
import { ExportBackupUseCase as ExportBackupUseCaseRegistration } from "../ExportBackupUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("ExportBackupUseCase", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createUseCase(): ExportBackupUseCase.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(BackupGatewayRegistration).inSingletonScope();
        container.register(ExportBackupUseCaseRegistration);

        return container.resolve(ExportBackupUseCase);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("should call exportBackupRoute via the gateway and return the payload", async () => {
        const payload: BackupGateway.BackupPayload = {
            version: 1,
            exportedAt: Date.now(),
            appSettings: [{ key: "theme", value: "dark" }],
            securitySettings: [],
            projects: [],
            dependencies: [],
            registryCache: []
        };
        mockResult = payload;

        const useCase = createUseCase();
        const result = await useCase.execute();

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(exportBackupRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual(payload);
    });
});
