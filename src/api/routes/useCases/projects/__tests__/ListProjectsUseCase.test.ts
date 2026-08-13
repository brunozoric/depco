import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { SecurityService } from "#api/services/Security/index.js";
import { ListProjectsUseCase, ProjectsUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup(securityResult: SecurityService.CheckResult | null = null) {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    container.registerInstance(SecurityService, {
        check: vi.fn(async () => ({ passes: true, checks: {} })),
        getLatest: vi.fn(async () => securityResult)
    });
    const useCase = container.resolve(ListProjectsUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, overrides: Partial<typeof projects.$inferInsert> = {}): string {
    const id = overrides.id ?? generateId();
    db.insert(projects)
        .values({
            id,
            name: "project",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now(),
            ...overrides
        })
        .run();
    return id;
}

describe("ListProjectsUseCase", () => {
    it("returns all projects with their security status and team badges", async () => {
        const security: SecurityService.CheckResult = { passes: true, checks: { a: true } };
        const { useCase, db } = setup(security);

        const projectId = insertProject(db, { name: "project-a" });
        const teamId = generateId();
        db.insert(teams)
            .values({ id: teamId, name: "Team A", color: "#fff", createdAt: Date.now() })
            .run();
        db.insert(teamProjects).values({ id: generateId(), teamId, projectId }).run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(1);
        expect(result.value.items).toHaveLength(1);
        const item = result.value.items[0]!;
        expect(item.name).toBe("project-a");
        expect(item.security).toEqual(security);
        expect(item.teams).toEqual([{ id: teamId, name: "Team A", color: "#fff" }]);
        expect(item.hasNodeModules).toBe(false);
    });

    it("paginates results using page and pageSize", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "a" });
        insertProject(db, { name: "b" });
        insertProject(db, { name: "c" });

        const result = await useCase.execute({ page: 2, pageSize: 2 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(3);
            expect(result.value.items).toHaveLength(1);
        }
    });

    it("returns an empty list when there are no projects", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([]);
            expect(result.value.total).toBe(0);
        }
    });
});
