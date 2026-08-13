import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, licenseSnapshots } from "#api/db/schema.js";
import { GetDashboardLicenseTrendUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardLicenseTrendUseCase);
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

function insertLicenseSnapshot(
    db: TestDb,
    overrides: Partial<typeof licenseSnapshots.$inferInsert> & { projectId: string; date: string }
): void {
    db.insert(licenseSnapshots)
        .values({
            id: generateId(),
            totalPackages: 10,
            compliantCount: 8,
            deniedCount: 1,
            warnedCount: 1,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetDashboardLicenseTrendUseCase", () => {
    it("sums license counts across projects for each date", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertProject(db, "p2");
        const date = isoDateDaysAgo(1);
        insertLicenseSnapshot(db, {
            projectId: "p1",
            date,
            compliantCount: 8,
            deniedCount: 1,
            warnedCount: 1,
            totalPackages: 10
        });
        insertLicenseSnapshot(db, {
            projectId: "p2",
            date,
            compliantCount: 4,
            deniedCount: 0,
            warnedCount: 0,
            totalPackages: 4
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]).toMatchObject({
                date,
                compliantCount: 12,
                deniedCount: 1,
                warnedCount: 1,
                totalPackages: 14
            });
        }
    });

    it("excludes points older than the requested day range", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertLicenseSnapshot(db, { projectId: "p1", date: isoDateDaysAgo(2), deniedCount: 1 });
        insertLicenseSnapshot(db, { projectId: "p1", date: isoDateDaysAgo(40), deniedCount: 9 });

        const result = await useCase.execute({ days: "7" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]!.deniedCount).toBe(1);
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
        insertLicenseSnapshot(db, { projectId: "p1", date, deniedCount: 1 });
        insertLicenseSnapshot(db, { projectId: "p2", date, deniedCount: 9 });

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points[0]!.deniedCount).toBe(1);
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
