import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, scanResults } from "#api/db/schema.js";
import { GetProjectDependenciesUseCase, ProjectsUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(GetProjectDependenciesUseCase);
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
            name: "react",
            currentVersion: "18.0.0",
            type: "dependency",
            dependencyKind: "dependency",
            registryResolved: 1,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetProjectDependenciesUseCase", () => {
    it("returns dependency rows for the project", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "react" });
        insertScanResult(db, id, { name: "lodash" });

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.map(item => item.name).sort()).toEqual(["lodash", "react"]);
        }
    });

    it("filters by dependencyKind", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "react", dependencyKind: "dependency" });
        insertScanResult(db, id, { name: "vitest", dependencyKind: "devDependency" });

        const result = await useCase.execute({ id, dependencyKind: "devDependency" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]!.name).toBe("vitest");
        }
    });

    it("filters by registryResolved", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "resolved-pkg", registryResolved: 1 });
        insertScanResult(db, id, { name: "unresolved-pkg", registryResolved: 0 });

        const result = await useCase.execute({ id, registryResolved: "false" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]!.name).toBe("unresolved-pkg");
            expect(result.value.items[0]!.registryResolved).toBe(false);
        }
    });

    it("filters by search substring", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "react" });
        insertScanResult(db, id, { name: "react-dom" });
        insertScanResult(db, id, { name: "lodash" });

        const result = await useCase.execute({ id, search: "react" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
        }
    });

    it("paginates results", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        insertProject(db, id);
        insertScanResult(db, id, { name: "a" });
        insertScanResult(db, id, { name: "b" });
        insertScanResult(db, id, { name: "c" });

        const result = await useCase.execute({ id, page: 2, pageSize: 2 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(3);
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]!.name).toBe("c");
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
