import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { teams, teamProjects, projects } from "#api/db/schema.js";
import { GetTeamUseCase } from "../abstractions/GetTeamUseCase.js";

describe("GetTeamUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: GetTeamUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(GetTeamUseCase);

        await db
            .insert(teams)
            .values({ id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
    });

    it("returns the team with its assigned projects", async () => {
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "webiny-js",
                path: "/repos/webiny-js",
                addedAt: Date.now()
            })
            .run();
        await db
            .insert(teamProjects)
            .values({ id: "tp-1", teamId: "team-1", projectId: "project-1" })
            .run();

        const result = await useCase.execute({ id: "team-1" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.id).toBe("team-1");
        expect(result.value.name).toBe("Platform");
        expect(result.value.projects).toEqual([
            { id: "project-1", name: "webiny-js", path: "/repos/webiny-js" }
        ]);
    });

    it("returns an empty projects list when no projects are assigned", async () => {
        const result = await useCase.execute({ id: "team-1" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.projects).toEqual([]);
    });

    it("fails with 404 when the team does not exist", async () => {
        const result = await useCase.execute({ id: "missing-team" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });
});
