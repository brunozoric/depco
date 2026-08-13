import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { teams, teamProjects, projects } from "#api/db/schema.js";
import { ListTeamsUseCase } from "../abstractions/ListTeamsUseCase.js";

describe("ListTeamsUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: ListTeamsUseCase.Interface;

    beforeEach(() => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(ListTeamsUseCase);
    });

    it("returns an empty list with total 0 when there are no teams", async () => {
        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toEqual([]);
        expect(result.value.total).toBe(0);
    });

    it("returns teams with default stats when no projects are assigned", async () => {
        await db
            .insert(teams)
            .values([
                { id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() },
                { id: "team-2", name: "Growth", color: "#00ff00", createdAt: Date.now() }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(2);
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]).toMatchObject({
            projectCount: 0,
            vulnerabilityCount: 0,
            compliantPercent: 100,
            averageHealthScore: 0
        });
    });

    it("computes projectCount from assigned projects", async () => {
        await db
            .insert(teams)
            .values({ id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
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

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items[0]?.projectCount).toBe(1);
    });

    it("respects page and pageSize", async () => {
        await db
            .insert(teams)
            .values([
                { id: "team-1", name: "Alpha", color: "#111111", createdAt: 1 },
                { id: "team-2", name: "Beta", color: "#222222", createdAt: 2 },
                { id: "team-3", name: "Gamma", color: "#333333", createdAt: 3 }
            ])
            .run();

        const result = await useCase.execute({ page: 2, pageSize: 2 });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(3);
        expect(result.value.items).toHaveLength(1);
    });
});
