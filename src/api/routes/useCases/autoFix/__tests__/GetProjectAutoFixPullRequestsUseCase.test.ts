import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, autoFixPullRequests } from "#api/db/schema.js";
import { GetProjectAutoFixPullRequestsUseCase } from "../abstractions/GetProjectAutoFixPullRequestsUseCase.js";

type TestDb = BetterSQLite3Database;

interface IInsertTestPullRequestOverrides {
    id: string;
    projectId: string;
    status?: string;
    upgradeType?: string;
    branchName?: string;
}

async function insertTestProject(db: TestDb, id: string): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/repo/${id}`,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

async function insertTestPullRequest(
    db: TestDb,
    overrides: IInsertTestPullRequestOverrides
): Promise<void> {
    const now = Date.now();
    await db
        .insert(autoFixPullRequests)
        .values({
            id: overrides.id,
            projectId: overrides.projectId,
            packageNames: JSON.stringify(["lodash"]),
            fromVersions: JSON.stringify({ lodash: "4.17.20" }),
            toVersions: JSON.stringify({ lodash: "4.17.21" }),
            upgradeType: overrides.upgradeType ?? "patch",
            branchName: overrides.branchName ?? `auto-fix/${overrides.id}`,
            prUrl: null,
            prNumber: null,
            status: overrides.status ?? "open",
            licenseWarnings: null,
            createdAt: now,
            updatedAt: now
        })
        .run();
}

describe("GetProjectAutoFixPullRequestsUseCase", () => {
    let db: TestDb;
    let useCase: GetProjectAutoFixPullRequestsUseCase.Interface;

    beforeEach(() => {
        const created = createTestApiContainer();
        db = created.db;
        useCase = created.container.resolve(GetProjectAutoFixPullRequestsUseCase);
    });

    it("returns only pull requests belonging to the given project", async () => {
        const projectId = generateId();
        const otherProjectId = generateId();
        await insertTestProject(db, projectId);
        await insertTestProject(db, otherProjectId);
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "merged" });
        await insertTestPullRequest(db, {
            id: generateId(),
            projectId: otherProjectId,
            status: "open"
        });

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.every(item => item.projectId === projectId)).toBe(true);
        }
    });

    it("filters by status within the project scope", async () => {
        const projectId = generateId();
        await insertTestProject(db, projectId);
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "merged" });

        const result = await useCase.execute({ projectId, status: "merged" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(1);
            expect(result.value.items[0]?.status).toBe("merged");
        }
    });
});
