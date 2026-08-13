import { describe, it, expect } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { LogsUseCasesFeature } from "../feature.js";
import { ListLogsUseCase } from "../abstractions/ListLogsUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ListLogsUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    LogsUseCasesFeature.register(container);

    return { container, db, useCase: container.resolve(ListLogsUseCase) };
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

describe("ListLogsUseCase", () => {
    it("lists logs ordered by newest first with a total count", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1", message: "first", createdAt: 1000 });
        await seedLog(db, { id: "log-2", message: "second", createdAt: 2000 });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value?.total).toBe(2);
        expect(result.value?.items.map(item => item.id)).toEqual(["log-2", "log-1"]);
    });

    it("filters logs by level, source, and project", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1", level: "error", source: "job", projectId: "p1" });
        await seedLog(db, { id: "log-2", level: "info", source: "job", projectId: "p1" });
        await seedLog(db, { id: "log-3", level: "error", source: "scan", projectId: "p2" });

        const result = await useCase.execute({ level: "error", source: "job", projectId: "p1" });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items.map(item => item.id)).toEqual(["log-1"]);
    });

    it("paginates results using limit and offset", async () => {
        const { useCase, db } = createContext();
        await seedLog(db, { id: "log-1", createdAt: 1000 });
        await seedLog(db, { id: "log-2", createdAt: 2000 });
        await seedLog(db, { id: "log-3", createdAt: 3000 });

        const result = await useCase.execute({ limit: "1", offset: "1" });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items).toHaveLength(1);
        expect(result.value?.items[0]?.id).toBe("log-2");
        expect(result.value?.total).toBe(3);
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createTestApiContainer();
        LogsUseCasesFeature.register(container);
        container.registerInstance(
            DatabaseClient,
            createThrowingDatabaseClient("database is locked")
        );
        const useCase = container.resolve(ListLogsUseCase);

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "database is locked" });
    });
});
