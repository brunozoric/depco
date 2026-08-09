import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { importBackupRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { BackupGateway } from "../../../../features/Backup/abstractions/BackupGateway.js";
import { BackupGateway as BackupGatewayRegistration } from "../../../../features/Backup/BackupGateway.js";
import { ImportBackupUseCase } from "../abstractions/ImportBackupUseCase.js";
import { ImportBackupUseCase as ImportBackupUseCaseRegistration } from "../ImportBackupUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("ImportBackupUseCase", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createUseCase(): ImportBackupUseCase.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(BackupGatewayRegistration).inSingletonScope();
        container.register(ImportBackupUseCaseRegistration);

        return container.resolve(ImportBackupUseCase);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("should call importBackupRoute via the gateway and return the result", async () => {
        const payload: BackupGateway.BackupPayload = {
            version: 1,
            exportedAt: Date.now(),
            appSettings: [],
            securitySettings: [],
            projects: [],
            dependencies: [],
            registryCache: []
        };
        const importResult: BackupGateway.ImportResult = {
            appSettings: { imported: 1, skipped: 0 },
            securitySettings: { imported: 0, skipped: 0 },
            projects: { imported: 2, skipped: 1, failed: 0, errors: [] },
            dependencies: { imported: 5, skipped: 0 },
            registryCache: { imported: 3, skipped: 0 }
        };
        mockResult = importResult;

        const useCase = createUseCase();
        const result = await useCase.execute(payload);

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(importBackupRoute);
        expect(calls[0]!.args).toEqual({ params: {}, body: payload });
        expect(result).toEqual(importResult);
    });
});
