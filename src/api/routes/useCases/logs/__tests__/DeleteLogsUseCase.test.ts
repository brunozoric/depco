import { describe, it, expect } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { LogsUseCasesFeature } from "../feature.js";
import { DeleteLogsUseCase } from "../abstractions/DeleteLogsUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: DeleteLogsUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    LogsUseCasesFeature.register(container);

    return { container, db, useCase: container.resolve(DeleteLogsUseCase) };
}

function createThrowingDatabaseClient(message: string): DatabaseClient.Interface {
    const throwingChain: unknown = new Proxy(
        {},
        {
            get(_target, property) {
                if (property === "all" || property === "get" || property === "run") {
                    return () => {
                        throw new Error(message);
                    };
                }
                return () => throwingChain;
            }
        }
    );

    return { db: throwingChain as TestDb };
}

async function seedLog(
    db: TestDb,
    overrides: Partial<typeof appLogs.$inferInsert> & { id: string }
): Promise<void> {
    await db
        .insert(appLogs)
        .values({
            level: "info",
            source: "test",
            message: "a log message",
            createdAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("DeleteLogsUseCase", () => {
    it("deletes all logs and reports the deleted count when no filters are given", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1" });
        await seedLog(db, { id: "log-2" });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ deleted: 2 });
        expect(await db.select().from(appLogs).all()).toHaveLength(0);
    });

    it("deletes only logs matching the given filters", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1", level: "error", projectId: "p1" });
        await seedLog(db, { id: "log-2", level: "info", projectId: "p1" });

        const result = await useCase.execute({ level: "error", projectId: "p1" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ deleted: 1 });
        const remaining = await db.select().from(appLogs).all();
        expect(remaining.map(log => log.id)).toEqual(["log-2"]);
    });

    it("returns zero deleted when no logs match the filters", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1", level: "info" });

        const result = await useCase.execute({ level: "error" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ deleted: 0 });
        expect(await db.select().from(appLogs).all()).toHaveLength(1);
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createTestApiContainer();
        LogsUseCasesFeature.register(container);
        container.registerInstance(
            DatabaseClient,
            createThrowingDatabaseClient("database is locked")
        );
        const useCase = container.resolve(DeleteLogsUseCase);

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "database is locked"
        });
    });
});
