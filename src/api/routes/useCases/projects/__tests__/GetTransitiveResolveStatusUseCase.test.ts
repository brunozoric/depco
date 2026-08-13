import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, scanResults } from "#api/db/schema.js";
import { GetTransitiveResolveStatusUseCase, ProjectsUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(GetTransitiveResolveStatusUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, id: string): void {
    db.insert(projects)
        .values({
            id,
            name: "p",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

function insertScanResult(
    db: TestDb,
    projectId: string,
    overrides: Partial<typeof scanResults.$inferInsert> = {}
): void {
    db.insert(scanResults)
        .values({
            id: generateId(),
            projectId,
            name: "pkg",
            currentVersion: "1.0.0",
            type: "dependency",
            dependencyKind: "transitive",
            registryResolved: 1,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetTransitiveResolveStatusUseCase", () => {
    it("counts resolved and pending transitive dependencies", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "a", registryResolved: 1 });
        insertScanResult(db, id, { name: "b", registryResolved: 1 });
        insertScanResult(db, id, { name: "c", registryResolved: 0 });
        // Non-transitive rows must be excluded from the counts.
        insertScanResult(db, id, {
            name: "direct",
            dependencyKind: "dependency",
            registryResolved: 0
        });

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(3);
            expect(result.value.resolved).toBe(2);
            expect(result.value.pending).toBe(1);
        }
    });

    it("returns zeros when there are no transitive dependencies", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ total: 0, resolved: 0, pending: 0 });
        }
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "unknown" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
        }
    });
});
