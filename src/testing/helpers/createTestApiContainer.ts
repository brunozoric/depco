import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { ApiFeature } from "#api/feature.js";
import { CommandRunner } from "#api/services/CommandRunner/index.js";
import { createTestDatabaseClient } from "./createTestDb.js";

interface ICreateTestApiContainerResult {
    container: Container;
    db: ReturnType<typeof createTestDatabaseClient>["db"];
}

export function createTestApiContainer(): ICreateTestApiContainerResult {
    const databaseClient = createTestDatabaseClient();
    const container = createContainer();

    process.env["ENCRYPTION_KEY"] = process.env["ENCRYPTION_KEY"] ?? "test-key-for-tests-only";

    ApiFeature.register(container, { databaseClient });

    container.registerInstance(CommandRunner, {
        run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });

    return { container, db: databaseClient.db };
}
