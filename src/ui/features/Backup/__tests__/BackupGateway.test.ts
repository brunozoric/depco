import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { exportBackupRoute, importBackupRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { BackupGateway } from "../abstractions/BackupGateway.js";
import { BackupGateway as BackupGatewayRegistration } from "../BackupGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("BackupGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): BackupGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(BackupGatewayRegistration);

        return container.resolve(BackupGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("exportBackup()", () => {
        it("should call exportBackupRoute with correct args and return the result", async () => {
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

            const gateway = createGateway();
            const result = await gateway.exportBackup();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(exportBackupRoute);
            expect(calls[0]!.args).toEqual({ params: {} });
            expect(result).toEqual(payload);
        });
    });

    describe("importBackup()", () => {
        it("should call importBackupRoute with correct args and return the result", async () => {
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

            const gateway = createGateway();
            const result = await gateway.importBackup(payload);

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(importBackupRoute);
            expect(calls[0]!.args).toEqual({ params: {}, body: payload });
            expect(result).toEqual(importResult);
        });
    });
});
