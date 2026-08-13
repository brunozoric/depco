import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, healthSnapshots } from "#api/db/schema.js";
import { GetDashboardTrendUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardTrendUseCase);
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

function isoDateDaysAgo(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function insertHealthSnapshot(db: TestDb, projectId: string, date: string, score: number): void {
    db.insert(healthSnapshots)
        .values({
            id: generateId(),
            projectId,
            date,
            score,
            totalPackages: 10,
            upToDate: 5,
            patchOutdated: 2,
            minorOutdated: 2,
            majorOutdated: 1,
            scannedAt: Date.now()
        })
        .run();
}

describe("GetDashboardTrendUseCase", () => {
    it("groups snapshots by project, ordered by date ascending", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1", "project-a");
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(5), 60);
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(2), 80);

        const result = await useCase.execute({ range: "30d" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]!.projectName).toBe("project-a");
            expect(result.value.items[0]!.snapshots.map(s => s.score)).toEqual([60, 80]);
        }
    });

    it("excludes snapshots older than the requested range", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(2), 80);
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(40), 20);

        const result = await useCase.execute({ range: "7d" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items[0]!.snapshots).toHaveLength(1);
            expect(result.value.items[0]!.snapshots[0]!.score).toBe(80);
        }
    });

    it("defaults to a 30 day range when none is provided", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(10), 80);
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(40), 20);

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items[0]!.snapshots).toHaveLength(1);
            expect(result.value.items[0]!.snapshots[0]!.score).toBe(80);
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
        insertHealthSnapshot(db, "p1", isoDateDaysAgo(1), 80);
        insertHealthSnapshot(db, "p2", isoDateDaysAgo(1), 20);

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.projectId)).toEqual(["p1"]);
        }
    });

    it("returns an empty list when there are no snapshots", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([]);
        }
    });
});
