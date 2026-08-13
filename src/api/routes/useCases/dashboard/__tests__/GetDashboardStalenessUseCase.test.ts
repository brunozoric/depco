import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { GetDashboardStalenessUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardStalenessUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, id: string, lastScannedAt: number | null): void {
    db.insert(projects)
        .values({
            id,
            name: `project-${id}`,
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now(),
            lastScannedAt
        })
        .run();
}

describe("GetDashboardStalenessUseCase", () => {
    it("orders never-scanned projects first, then oldest-scanned to newest", async () => {
        const { useCase, db } = setup();
        insertProject(db, "recent", 3000);
        insertProject(db, "never-scanned", null);
        insertProject(db, "stale", 1000);

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.projectId)).toEqual([
                "never-scanned",
                "stale",
                "recent"
            ]);
        }
    });

    it("filters to a team's projects when teamId is given", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1", 1000);
        insertProject(db, "p2", 2000);
        const teamId = generateId();
        db.insert(teams)
            .values({ id: teamId, name: "Team A", color: "#fff", createdAt: Date.now() })
            .run();
        db.insert(teamProjects).values({ id: generateId(), teamId, projectId: "p1" }).run();

        const result = await useCase.execute({ teamId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items.map(item => item.projectId)).toEqual(["p1"]);
        }
    });

    it("returns an empty list when there are no projects", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([]);
        }
    });
});
