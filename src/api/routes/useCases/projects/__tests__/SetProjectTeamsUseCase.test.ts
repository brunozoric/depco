import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { SetProjectTeamsUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(SetProjectTeamsUseCase);
    return { useCase, db };
}

describe("SetProjectTeamsUseCase", () => {
    it("assigns the given teams to the project, de-duplicating team ids", async () => {
        const { useCase, db } = setup();
        const projectId = generateId();
        db.insert(projects)
            .values({
                id: projectId,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();
        const teamAId = generateId();
        const teamBId = generateId();
        db.insert(teams)
            .values([
                { id: teamAId, name: "Team A", color: "#aaa", createdAt: Date.now() },
                { id: teamBId, name: "Team B", color: "#bbb", createdAt: Date.now() }
            ])
            .run();

        const result = await useCase.execute({
            id: projectId,
            teamIds: [teamAId, teamBId, teamAId]
        });

        expect(result.isOk()).toBe(true);
        const rows = db
            .select()
            .from(teamProjects)
            .where(eq(teamProjects.projectId, projectId))
            .all();
        expect(rows.map(row => row.teamId).sort()).toEqual([teamAId, teamBId].sort());
    });

    it("replaces previously assigned teams", async () => {
        const { useCase, db } = setup();
        const projectId = generateId();
        db.insert(projects)
            .values({
                id: projectId,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();
        const teamAId = generateId();
        const teamBId = generateId();
        db.insert(teams)
            .values([
                { id: teamAId, name: "Team A", color: "#aaa", createdAt: Date.now() },
                { id: teamBId, name: "Team B", color: "#bbb", createdAt: Date.now() }
            ])
            .run();
        await useCase.execute({ id: projectId, teamIds: [teamAId] });

        const result = await useCase.execute({ id: projectId, teamIds: [teamBId] });

        expect(result.isOk()).toBe(true);
        const rows = db
            .select()
            .from(teamProjects)
            .where(eq(teamProjects.projectId, projectId))
            .all();
        expect(rows.map(row => row.teamId)).toEqual([teamBId]);
    });

    it("clears all team assignments when given an empty list", async () => {
        const { useCase, db } = setup();
        const projectId = generateId();
        db.insert(projects)
            .values({
                id: projectId,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();
        const teamId = generateId();
        db.insert(teams)
            .values({ id: teamId, name: "Team A", color: "#aaa", createdAt: Date.now() })
            .run();
        await useCase.execute({ id: projectId, teamIds: [teamId] });

        const result = await useCase.execute({ id: projectId, teamIds: [] });

        expect(result.isOk()).toBe(true);
        const rows = db
            .select()
            .from(teamProjects)
            .where(eq(teamProjects.projectId, projectId))
            .all();
        expect(rows).toEqual([]);
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "unknown", teamIds: [] });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
        }
    });
});
