import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { GetProjectTeamsUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(GetProjectTeamsUseCase);
    return { useCase, db };
}

describe("GetProjectTeamsUseCase", () => {
    it("returns the teams a project belongs to", async () => {
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
            .values({ id: teamId, name: "Team A", color: "#123456", createdAt: Date.now() })
            .run();
        db.insert(teamProjects).values({ id: generateId(), teamId, projectId }).run();

        const result = await useCase.execute({ id: projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(1);
            expect(result.value.items).toEqual([{ id: teamId, name: "Team A", color: "#123456" }]);
        }
    });

    it("returns an empty list when the project belongs to no teams", async () => {
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

        const result = await useCase.execute({ id: projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: [], total: 0 });
        }
    });
});
