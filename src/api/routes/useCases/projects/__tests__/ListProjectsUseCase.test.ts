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
        getLatest: vi.fn(async () => securityResult),
        getLatestForProjects: vi.fn(async (ids: string[]) => {
            const map = new Map<string, SecurityService.CheckResult>();
            if (securityResult) {
                for (const id of ids) {
                    map.set(id, securityResult);
                }
            }
            return map;
        })
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

    it("sorts by name ascending by default", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "charlie" });
        insertProject(db, { name: "alpha" });
        insertProject(db, { name: "bravo" });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        const names = result.value.items.map(item => item.name);
        expect(names).toEqual(["alpha", "bravo", "charlie"]);
    });

    it("sorts by name descending when sortOrder is desc", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "alpha" });
        insertProject(db, { name: "charlie" });

        const result = await useCase.execute({ sortBy: "name", sortOrder: "desc" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        const names = result.value.items.map(item => item.name);
        expect(names).toEqual(["charlie", "alpha"]);
    });

    it("sorts by lastScannedAt with nulls last", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "never-scanned", lastScannedAt: null });
        insertProject(db, { name: "old", lastScannedAt: 1000 });
        insertProject(db, { name: "recent", lastScannedAt: 5000 });

        const result = await useCase.execute({ sortBy: "lastScannedAt", sortOrder: "desc" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        const names = result.value.items.map(item => item.name);
        expect(names).toEqual(["recent", "old", "never-scanned"]);
    });

    it("sorts by engineStatus with eol first (ascending)", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "healthy", engineStatus: "current" });
        insertProject(db, { name: "risky", engineStatus: "eol" });
        insertProject(db, { name: "aging", engineStatus: "maintenance" });

        const result = await useCase.execute({ sortBy: "engineStatus", sortOrder: "asc" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        const names = result.value.items.map(item => item.name);
        expect(names).toEqual(["risky", "aging", "healthy"]);
    });

    it("sorts by engineStatus with null (never scanned) last", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "no-scan", engineStatus: null });
        insertProject(db, { name: "eol-project", engineStatus: "eol" });

        const result = await useCase.execute({ sortBy: "engineStatus", sortOrder: "asc" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        const names = result.value.items.map(item => item.name);
        expect(names).toEqual(["eol-project", "no-scan"]);
    });

    it("filters by single engine status", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "eol-one", engineStatus: "eol" });
        insertProject(db, { name: "current-one", engineStatus: "current" });

        const result = await useCase.execute({ engineStatus: "eol" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]!.name).toBe("eol-one");
        expect(result.value.total).toBe(1);
    });

    it("filters by multiple comma-separated engine statuses", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "eol-one", engineStatus: "eol" });
        insertProject(db, { name: "maint-one", engineStatus: "maintenance" });
        insertProject(db, { name: "current-one", engineStatus: "current" });

        const result = await useCase.execute({ engineStatus: "eol,maintenance" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toHaveLength(2);
        expect(result.value.total).toBe(2);
    });

    it("uses getLatestForProjects for bulk security lookup across multiple projects", async () => {
        const getLatestForProjects = vi.fn(async (ids: string[]) => {
            const map = new Map<string, SecurityService.CheckResult>();
            map.set(ids[0]!, { passes: true, checks: { a: true } });
            map.set(ids[1]!, { passes: false, checks: { a: false } });
            return map;
        });

        const { container, db } = createTestApiContainer();
        ProjectsUseCasesFeature.register(container);
        container.registerInstance(SecurityService, {
            check: vi.fn(async () => ({ passes: true, checks: {} })),
            getLatest: vi.fn(async () => null),
            getLatestForProjects
        });

        const id1 = insertProject(db, { name: "project-one" });
        const id2 = insertProject(db, { name: "project-two" });

        const useCase = container.resolve(ListProjectsUseCase);
        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }

        expect(getLatestForProjects).toHaveBeenCalledTimes(1);
        expect(getLatestForProjects).toHaveBeenCalledWith(expect.arrayContaining([id1, id2]));

        const items = result.value.items;
        const item1 = items.find(item => item.name === "project-one")!;
        const item2 = items.find(item => item.name === "project-two")!;
        expect(item1.security).toEqual({ passes: true, checks: { a: true } });
        expect(item2.security).toEqual({ passes: false, checks: { a: false } });
    });

    it("includes engineStatus and rootEnginesNode in response items", async () => {
        const { useCase, db } = setup();
        insertProject(db, {
            name: "with-engine",
            engineStatus: "active-lts",
            rootEnginesNode: ">=18"
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items[0]!.engineStatus).toBe("active-lts");
        expect(result.value.items[0]!.rootEnginesNode).toBe(">=18");
    });
});
