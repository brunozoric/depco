import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, healthSnapshots } from "#api/db/schema.js";
import { GetDashboardHealthUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardHealthUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, id: string, name = `project-${id}`): void {
    db.insert(projects)
        .values({
            id,
            name,
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

function insertHealthSnapshot(
    db: TestDb,
    overrides: Partial<typeof healthSnapshots.$inferInsert> & {
        projectId: string;
        date: string;
        score: number;
    }
): void {
    db.insert(healthSnapshots)
        .values({
            id: generateId(),
            totalPackages: 10,
            upToDate: 5,
            patchOutdated: 2,
            minorOutdated: 2,
            majorOutdated: 1,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetDashboardHealthUseCase", () => {
    it("returns the latest snapshot per project, worst-scoring first", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1", "healthy-project");
        insertProject(db, "p2", "unhealthy-project");
        insertHealthSnapshot(db, { projectId: "p1", date: "2024-06-20", score: 90 });
        insertHealthSnapshot(db, { projectId: "p2", date: "2024-06-20", score: 40 });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.projects.map(project => project.projectId)).toEqual(["p2", "p1"]);
        expect(result.value.summary.totalProjects).toBe(2);
        expect(result.value.summary.averageScore).toBe(65);
        expect(result.value.summary.worstProject).toMatchObject({
            id: "p2",
            name: "unhealthy-project",
            score: 40
        });
    });

    it("computes scoreDelta against the snapshot from 7+ days earlier", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertHealthSnapshot(db, { projectId: "p1", date: "2024-06-01", score: 50 });
        insertHealthSnapshot(db, { projectId: "p1", date: "2024-06-20", score: 80 });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projects[0]!.scoreDelta).toBe(30);
        }
    });

    it("returns null scoreDelta when there is no earlier snapshot", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertHealthSnapshot(db, { projectId: "p1", date: "2024-06-20", score: 80 });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projects[0]!.scoreDelta).toBeNull();
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
        insertHealthSnapshot(db, { projectId: "p1", date: "2024-06-20", score: 80 });
        insertHealthSnapshot(db, { projectId: "p2", date: "2024-06-20", score: 40 });

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projects.map(project => project.projectId)).toEqual(["p1"]);
        }
    });

    it("returns a zeroed summary and empty projects list when there are no snapshots", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.summary).toEqual({
                totalProjects: 0,
                averageScore: 0,
                worstProject: null
            });
            expect(result.value.projects).toEqual([]);
        }
    });
});
