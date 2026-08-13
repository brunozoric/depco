import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects, autoFixPullRequests } from "#api/db/schema.js";
import { GetDashboardAutoFixTrendUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardAutoFixTrendUseCase);
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

function msDaysAgo(daysAgo: number): number {
    return Date.now() - daysAgo * 24 * 60 * 60 * 1000;
}

function isoDateFromMs(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

function insertAutoFixPr(
    db: TestDb,
    overrides: Partial<typeof autoFixPullRequests.$inferInsert> & {
        projectId: string;
        branchName: string;
        updatedAt: number;
    }
): void {
    db.insert(autoFixPullRequests)
        .values({
            id: generateId(),
            packageNames: JSON.stringify(["react"]),
            fromVersions: JSON.stringify(["18.0.0"]),
            toVersions: JSON.stringify(["18.1.0"]),
            upgradeType: "minor",
            status: "created",
            createdAt: Date.now(),
            ...overrides
        })
        .run();
}

describe("GetDashboardAutoFixTrendUseCase", () => {
    it("counts pull requests per status for each date", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        const updatedAt = msDaysAgo(1);
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "branch-1",
            status: "created",
            updatedAt
        });
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "branch-2",
            status: "merged",
            updatedAt
        });
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "branch-3",
            status: "failed",
            updatedAt
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]).toMatchObject({
                date: isoDateFromMs(updatedAt),
                created: 1,
                merged: 1,
                failed: 1,
                pending: 0,
                closed: 0
            });
        }
    });

    it("excludes points older than the requested day range", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "recent",
            status: "created",
            updatedAt: msDaysAgo(2)
        });
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "old",
            status: "created",
            updatedAt: msDaysAgo(40)
        });

        const result = await useCase.execute({ days: "7" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toHaveLength(1);
            expect(result.value.points[0]!.created).toBe(1);
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
        const updatedAt = msDaysAgo(1);
        insertAutoFixPr(db, {
            projectId: "p1",
            branchName: "in-team",
            status: "created",
            updatedAt
        });
        insertAutoFixPr(db, {
            projectId: "p2",
            branchName: "outside-team",
            status: "created",
            updatedAt
        });

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points[0]!.created).toBe(1);
        }
    });

    it("returns an empty list when there are no auto-fix pull requests", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.points).toEqual([]);
        }
    });
});
