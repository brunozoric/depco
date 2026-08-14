import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "../scanScheduleHelper.js";
import { ListScanSchedulesUseCase, ScanSchedulesUseCasesFeature } from "../index.js";

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

    return { container, db, useCase: container.resolve(ListScanSchedulesUseCase) };
}

describe("ListScanSchedulesUseCase", () => {
    it("resolves each project's schedule, preferring per-project overrides over the global default", async () => {
        const { db, useCase } = createContext();
        db.insert(appSettings).values({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: "12h" }).run();

        const overriddenId = generateId();
        const defaultedId = generateId();
        db.insert(projects)
            .values([
                {
                    id: overriddenId,
                    name: "overridden-project",
                    path: "/tmp/overridden-project",
                    packageManager: "yarn",
                    pmVersion: "4.0.0",
                    addedAt: Date.now()
                },
                {
                    id: defaultedId,
                    name: "defaulted-project",
                    path: "/tmp/defaulted-project",
                    packageManager: "npm",
                    pmVersion: "10.0.0",
                    addedAt: Date.now()
                }
            ])
            .run();
        db.insert(scanSchedules)
            .values({
                id: generateId(),
                projectId: overriddenId,
                interval: "6h",
                lastRunAt: 1000,
                nextRunAt: 2000,
                enabled: 1,
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.globalDefault).toBe("12h");
        const byProjectId = new Map(result.value.items.map(item => [item.projectId, item]));
        expect(byProjectId.get(overriddenId)).toEqual({
            projectId: overriddenId,
            projectName: "overridden-project",
            interval: "6h",
            source: "project",
            lastRunAt: 1000,
            nextRunAt: 2000
        });
        expect(byProjectId.get(defaultedId)).toEqual({
            projectId: defaultedId,
            projectName: "defaulted-project",
            interval: "12h",
            source: "default",
            lastRunAt: null,
            nextRunAt: null
        });
    });

    it("returns an empty list with a disabled default when there are no projects or settings", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: [], globalDefault: "disabled" });
        }
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createContext();
        container.registerInstance(
            DatabaseClient,
            createThrowingDatabaseClient("database unavailable")
        );
        const useCase = container.resolve(ListScanSchedulesUseCase);

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "database unavailable"
        });
    });
});
