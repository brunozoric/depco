import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { teams, teamProjects, projects } from "#api/db/schema.js";
import { SetTeamProjectsUseCase } from "../abstractions/SetTeamProjectsUseCase.js";

describe("SetTeamProjectsUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: SetTeamProjectsUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(SetTeamProjectsUseCase);

        await db
            .insert(teams)
            .values({ id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
        await db
            .insert(projects)
            .values([
                {
                    id: "project-1",
                    name: "webiny-js",
                    path: "/repos/webiny-js",
                    addedAt: Date.now()
                },
                { id: "project-2", name: "docs", path: "/repos/docs", addedAt: Date.now() }
            ])
            .run();
    });

    it("assigns the given projects to the team", async () => {
        const result = await useCase.execute({
            id: "team-1",
            projectIds: ["project-1", "project-2"]
        });

        expect(result.isOk()).toBe(true);

        const rows = await db.select().from(teamProjects).all();
        expect(rows.map(row => row.projectId).sort()).toEqual(["project-1", "project-2"]);
    });

    it("replaces the previous assignment rather than appending", async () => {
        await useCase.execute({ id: "team-1", projectIds: ["project-1"] });

        const result = await useCase.execute({ id: "team-1", projectIds: ["project-2"] });

        expect(result.isOk()).toBe(true);
        const rows = await db.select().from(teamProjects).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.projectId).toBe("project-2");
    });

    it("deduplicates repeated project ids", async () => {
        await useCase.execute({ id: "team-1", projectIds: ["project-1", "project-1"] });

        const rows = await db.select().from(teamProjects).all();
        expect(rows).toHaveLength(1);
    });

    it("clears all assignments when given an empty list", async () => {
        await useCase.execute({ id: "team-1", projectIds: ["project-1"] });

        const result = await useCase.execute({ id: "team-1", projectIds: [] });

        expect(result.isOk()).toBe(true);
        const rows = await db.select().from(teamProjects).all();
        expect(rows).toHaveLength(0);
    });

    it("fails with 404 when the team does not exist", async () => {
        const result = await useCase.execute({ id: "missing-team", projectIds: ["project-1"] });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.code).toBe("TEAM_NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
    });
});
