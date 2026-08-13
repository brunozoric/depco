import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "../scanScheduleHelper.js";
import { GetScanScheduleDefaultUseCase, ScanSchedulesUseCasesFeature } from "../index.js";

function createThrowingDatabaseClient(message: string): DatabaseClient.Interface {
    const db = new Proxy(
        {},
        {
            get(): never {
                throw new Error(message);
            }
        }
    ) as DatabaseClient.Interface["db"];

    return { db };
}

function createContext() {
    const { container, db } = createTestApiContainer();
    ScanSchedulesUseCasesFeature.register(container);

    return { container, db, useCase: container.resolve(GetScanScheduleDefaultUseCase) };
}

describe("GetScanScheduleDefaultUseCase", () => {
    it("returns the stored global default interval", async () => {
        const { db, useCase } = createContext();
        db.insert(appSettings).values({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: "24h" }).run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ interval: "24h" });
        }
    });

    it("falls back to disabled when no default has been set", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ interval: "disabled" });
        }
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createContext();
        container.registerInstance(
            DatabaseClient,
            createThrowingDatabaseClient("database unavailable")
        );
        const useCase = container.resolve(GetScanScheduleDefaultUseCase);

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "database unavailable" });
    });
});
