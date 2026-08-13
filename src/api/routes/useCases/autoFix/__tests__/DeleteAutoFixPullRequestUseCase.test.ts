import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, autoFixPullRequests } from "#api/db/schema.js";
import { DeleteAutoFixPullRequestUseCase } from "../abstractions/DeleteAutoFixPullRequestUseCase.js";

type TestDb = BetterSQLite3Database;

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
    overrides: { id: string; projectId: string }
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
            upgradeType: "patch",
            branchName: `auto-fix/${overrides.id}`,
            prUrl: null,
            prNumber: null,
            status: "open",
            licenseWarnings: null,
            createdAt: now,
            updatedAt: now
        })
        .run();
}

describe("DeleteAutoFixPullRequestUseCase", () => {
    let db: TestDb;
    let useCase: DeleteAutoFixPullRequestUseCase.Interface;

    beforeEach(() => {
        const created = createTestApiContainer();
        db = created.db;
        useCase = created.container.resolve(DeleteAutoFixPullRequestUseCase);
    });

    it("deletes an existing pull request row", async () => {
        const projectId = generateId();
        const pullRequestId = generateId();
        await insertTestProject(db, projectId);
        await insertTestPullRequest(db, { id: pullRequestId, projectId });

        const result = await useCase.execute({ id: pullRequestId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: true });
        }

        const remaining = await db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.id, pullRequestId))
            .all();
        expect(remaining).toHaveLength(0);
    });

    it("returns deleted: true even when no matching row exists", async () => {
        const result = await useCase.execute({ id: "never-existed" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: true });
        }
    });
});
