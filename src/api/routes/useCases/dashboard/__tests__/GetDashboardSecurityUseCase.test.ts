import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, securityChecks } from "#api/db/schema.js";
import { GetDashboardSecurityUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardSecurityUseCase);
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

describe("GetDashboardSecurityUseCase", () => {
    it("returns the latest security check per project, worst passing ratio first", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1", "mostly-passing");
        insertProject(db, "p2", "mostly-failing");
        db.insert(securityChecks)
            .values([
                {
                    id: generateId(),
                    projectId: "p1",
                    checkedAt: 1000,
                    results: JSON.stringify([true, true, true, false]),
                    passes: 3
                },
                {
                    id: generateId(),
                    projectId: "p2",
                    checkedAt: 1000,
                    results: JSON.stringify([true, false, false, false]),
                    passes: 1
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.projectId)).toEqual(["p2", "p1"]);
            expect(result.value.items[0]).toMatchObject({ totalChecks: 4, passingChecks: 1 });
        }
    });

    it("only considers the most recent check for each project", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(securityChecks)
            .values([
                {
                    id: generateId(),
                    projectId: "p1",
                    checkedAt: 1000,
                    results: JSON.stringify([true, false]),
                    passes: 1
                },
                {
                    id: generateId(),
                    projectId: "p1",
                    checkedAt: 2000,
                    results: JSON.stringify([true, true]),
                    passes: 2
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]).toMatchObject({ totalChecks: 2, passingChecks: 2 });
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
        db.insert(securityChecks)
            .values([
                {
                    id: generateId(),
                    projectId: "p1",
                    checkedAt: 1000,
                    results: JSON.stringify([true]),
                    passes: 1
                },
                {
                    id: generateId(),
                    projectId: "p2",
                    checkedAt: 1000,
                    results: JSON.stringify([true]),
                    passes: 1
                }
            ])
            .run();

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.projectId)).toEqual(["p1"]);
        }
    });

    it("returns an empty list when there are no security checks", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([]);
        }
    });
});
