import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, healthSnapshots } from "#api/db/schema.js";
import { GetDashboardStalenessTrendUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardStalenessTrendUseCase);
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

function isoDateDaysAgo(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function insertHealthSnapshot(
    db: TestDb,
    overrides: Partial<typeof healthSnapshots.$inferInsert> & { projectId: string; date: string }
): void {
    db.insert(healthSnapshots)
        .values({
            id: generateId(),
            score: 50,
            totalPackages: 10,
            upToDate: 5,
            patchOutdated: 0,
            minorOutdated: 0,
            majorOutdated: 0,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetDashboardStalenessTrendUseCase", () => {
    it("sums staleness counts across projects for each date", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertProject(db, "p2");
        const date = isoDateDaysAgo(1);
        insertHealthSnapshot(db, {
            projectId: "p1",
            date,
            patchOutdated: 1,
            minorOutdated: 2,
            majorOutdated: 0,
            totalPackages: 10
        });
        insertHealthSnapshot(db, {
            projectId: "p2",
            date,
            patchOutdated: 3,
            minorOutdated: 0,
            majorOutdated: 1,
            totalPackages: 5
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]).toMatchObject({
                date,
                patchOutdated: 4,
                minorOutdated: 2,
                majorOutdated: 1,
                totalPackages: 15
            });
        }
    });

    it("excludes points older than the requested day range", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertHealthSnapshot(db, { projectId: "p1", date: isoDateDaysAgo(2), patchOutdated: 2 });
        insertHealthSnapshot(db, { projectId: "p1", date: isoDateDaysAgo(40), patchOutdated: 9 });

        const result = await useCase.execute({ days: "7" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]!.patchOutdated).toBe(2);
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
        const date = isoDateDaysAgo(1);
        insertHealthSnapshot(db, { projectId: "p1", date, patchOutdated: 2 });
        insertHealthSnapshot(db, { projectId: "p2", date, patchOutdated: 9 });

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points[0]!.patchOutdated).toBe(2);
        }
    });

    it("returns an empty list when there are no snapshots", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toEqual([]);
        }
    });
});
