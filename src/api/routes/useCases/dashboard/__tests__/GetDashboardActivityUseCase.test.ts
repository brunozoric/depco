import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, upgradeJobs } from "#api/db/schema.js";
import { GetDashboardActivityUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardActivityUseCase);
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

describe("GetDashboardActivityUseCase", () => {
    it("returns recent jobs ordered by start time, most recent first", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(upgradeJobs)
            .values([
                {
                    id: "j1",
                    referenceId: "p1",
                    type: "scan",
                    status: "completed",
                    startedAt: 1000,
                    completedAt: 2000
                },
                {
                    id: "j2",
                    referenceId: "p1",
                    type: "dependency",
                    status: "completed",
                    startedAt: 3000,
                    completedAt: 4000
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.id)).toEqual(["j2", "j1"]);
        }
    });

    it("filters activity to jobs belonging to the given team's projects", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertProject(db, "p2");
        const teamId = generateId();
        db.insert(teams)
            .values({ id: teamId, name: "Team A", color: "#fff", createdAt: Date.now() })
            .run();
        db.insert(teamProjects).values({ id: generateId(), teamId, projectId: "p1" }).run();
        db.insert(upgradeJobs)
            .values([
                {
                    id: "j1",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "scan",
                    status: "completed",
                    startedAt: 1000
                },
                {
                    id: "j2",
                    referenceId: "p2",
                    referenceType: "project",
                    type: "scan",
                    status: "completed",
                    startedAt: 2000
                }
            ])
            .run();

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.id)).toEqual(["j1"]);
        }
    });

    it("returns an empty list when there are no jobs", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([]);
        }
    });
});
