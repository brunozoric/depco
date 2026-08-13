import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, autoFixPullRequests } from "#api/db/schema.js";
import { ListAutoFixPullRequestsUseCase } from "../abstractions/ListAutoFixPullRequestsUseCase.js";

type TestDb = BetterSQLite3Database;

interface IInsertTestProjectOverrides {
    name?: string;
    packageManager?: string | null;
}

interface IInsertTestPullRequestOverrides {
    id: string;
    projectId: string;
    status?: string;
    upgradeType?: string;
    branchName?: string;
}

async function insertTestProject(
    db: TestDb,
    id: string,
    overrides: IInsertTestProjectOverrides = {}
): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: overrides.name ?? id,
            path: `/repo/${id}`,
            packageManager: overrides.packageManager ?? "yarn",
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

describe("ListAutoFixPullRequestsUseCase", () => {
    let db: TestDb;
    let useCase: ListAutoFixPullRequestsUseCase.Interface;

    beforeEach(() => {
        const created = createTestApiContainer();
        db = created.db;
        useCase = created.container.resolve(ListAutoFixPullRequestsUseCase);
    });

    it("returns all pull requests with parsed JSON fields when no filters are given", async () => {
        const projectId = generateId();
        await insertTestProject(db, projectId);
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "merged" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(3);
            expect(result.value.items).toHaveLength(3);
            const [item] = result.value.items;
            expect(item?.packageNames).toEqual(["lodash"]);
            expect(item?.fromVersions).toEqual({ lodash: "4.17.20" });
            expect(item?.toVersions).toEqual({ lodash: "4.17.21" });
            expect(item?.licenseWarnings).toEqual([]);
        }
    });

    it("filters by status", async () => {
        const projectId = generateId();
        await insertTestProject(db, projectId);
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "merged" });
        await insertTestPullRequest(db, { id: generateId(), projectId, status: "open" });

        const result = await useCase.execute({ status: "open" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.every(item => item.status === "open")).toBe(true);
        }
    });

    it("paginates results", async () => {
        const projectId = generateId();
        await insertTestProject(db, projectId);
        await insertTestPullRequest(db, { id: generateId(), projectId });
        await insertTestPullRequest(db, { id: generateId(), projectId });
        await insertTestPullRequest(db, { id: generateId(), projectId });

        const result = await useCase.execute({ page: 1, pageSize: 2 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(2);
            expect(result.value.total).toBe(3);
        }
    });

    it("returns an empty result for a project with no pull requests", async () => {
        const result = await useCase.execute({ projectId: "does-not-exist" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: [], total: 0 });
        }
    });
});
