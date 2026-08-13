import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, dependencyChanges } from "#api/db/schema.js";
import { GetDashboardDependencyChangesUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardDependencyChangesUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, id: string): void {
    db.insert(projects)
        .values({
            id,
            name: `project-${id}`,
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

function insertChange(
    db: TestDb,
    overrides: Partial<typeof dependencyChanges.$inferInsert> & {
        projectId: string;
        detectedAt: number;
    }
): void {
    db.insert(dependencyChanges)
        .values({
            id: generateId(),
            packageName: "react",
            changeType: "version-changed",
            previousVersion: "18.0.0",
            newVersion: "18.1.0",
            ...overrides
        })
        .run();
}

describe("GetDashboardDependencyChangesUseCase", () => {
    it("returns changes ordered by most recently detected", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertChange(db, { projectId: "p1", packageName: "old-change", detectedAt: 1000 });
        insertChange(db, { projectId: "p1", packageName: "new-change", detectedAt: 2000 });

        const result = await useCase.execute({ limit: 20 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.map(item => item.packageName)).toEqual([
                "new-change",
                "old-change"
            ]);
        }
    });

    it("filters by projectId", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertProject(db, "p2");
        insertChange(db, { projectId: "p1", packageName: "in-p1", detectedAt: 1000 });
        insertChange(db, { projectId: "p2", packageName: "in-p2", detectedAt: 2000 });

        const result = await useCase.execute({ projectId: "p1", limit: 20 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(1);
            expect(result.value.items[0]!.packageName).toBe("in-p1");
        }
    });

    it("filters to a team's projects when teamId is given", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertProject(db, "p2");
        const teamId = generateId();
        db.insert(teams)
            .values({ id: teamId, name: "Team A", color: "#fff", createdAt: Date.now() })
            .run();
        db.insert(teamProjects).values({ id: generateId(), teamId, projectId: "p1" }).run();
        insertChange(db, { projectId: "p1", packageName: "in-team", detectedAt: 1000 });
        insertChange(db, { projectId: "p2", packageName: "outside-team", detectedAt: 2000 });

        const result = await useCase.execute({ teamId, limit: 20 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.packageName)).toEqual(["in-team"]);
        }
    });

    it("respects the limit parameter", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertChange(db, { projectId: "p1", packageName: "a", detectedAt: 1000 });
        insertChange(db, { projectId: "p1", packageName: "b", detectedAt: 2000 });
        insertChange(db, { projectId: "p1", packageName: "c", detectedAt: 3000 });

        const result = await useCase.execute({ limit: 2 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(2);
            expect(result.value.total).toBe(3);
        }
    });

    it("returns an empty list when there are no dependency changes", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ limit: 20 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: [], total: 0 });
        }
    });
});
