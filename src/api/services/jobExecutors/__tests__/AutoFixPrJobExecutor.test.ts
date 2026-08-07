import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { AutoFixPrJobExecutor } from "../abstractions/AutoFixPrJobExecutor.js";
import { AutoFixPrJobExecutor as AutoFixPrJobExecutorRegistration } from "../AutoFixPrJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import { AutoFixPrService } from "../../abstractions/AutoFixPrService.js";
import { GitService } from "../../abstractions/GitService.js";
import { ForgeService } from "../../abstractions/ForgeService.js";
import { UpgradeService } from "../../Upgrade/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { projects, autoFixPullRequests } from "#api/db/schema.js";

function createMockContext(referenceId: string): JobExecutor.ExecutionContext {
    return {
        jobId: "job-1",
        referenceId,
        projectPath: "/test/project",
        packageManager: "yarn",
        packagesJson: null,
        project: null,
        appendLog: vi.fn(),
        setProgress: vi.fn(),
        signal: new AbortController().signal
    };
}

function createStubAutoFixPrService(
    overrides: Partial<AutoFixPrService.Interface> = {}
): AutoFixPrService.Interface {
    return {
        generateForProject: vi.fn(async () => ({
            pending: [],
            skippedDeny: [],
            skippedDuplicate: []
        })),
        buildPrBody: vi.fn(() => "## PR BODY"),
        ...overrides
    };
}

function createStubGitService(overrides: Partial<GitService.Interface> = {}): GitService.Interface {
    return {
        getCurrentBranch: vi.fn(async () => "main"),
        createAndCheckoutBranch: vi.fn(async () => {}),
        checkout: vi.fn(async () => {}),
        getStatus: vi.fn(async () => []),
        stageAll: vi.fn(async () => {}),
        commit: vi.fn(async () => "abc1234"),
        push: vi.fn(async () => ({ success: true, output: "" })),
        ...overrides
    };
}

function createStubForgeService(
    overrides: Partial<ForgeService.Interface> = {}
): ForgeService.Interface {
    return {
        detectForge: vi.fn(async (): Promise<ForgeService.Type> => "github"),
        createPr: vi.fn(async () => ({
            url: "https://github.com/org/repo/pull/1",
            number: 1
        })),
        parseRemoteUrl: vi.fn(() => ({ owner: "org", repo: "repo" })),
        ...overrides
    };
}

function createStubUpgradeService(
    overrides: Partial<UpgradeService.Interface> = {}
): UpgradeService.Interface {
    return {
        upgradePackage: vi.fn(async () => {}),
        refreshTransient: vi.fn(async () => {}),
        ...overrides
    };
}

function createStubBroadcaster(): WebSocketBroadcaster.Interface {
    return {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn(),
        closeConnectionsForUser: vi.fn()
    };
}

interface IInsertPendingRecordInput {
    id: string;
    projectId: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    licenseWarnings?: string[];
}

describe("AutoFixPrJobExecutor", () => {
    let databaseClient: DatabaseClient.Interface;
    const projectId = "project-1";

    beforeEach(async () => {
        databaseClient = await createTestDatabaseClient();
        await databaseClient.db
            .insert(projects)
            .values({
                id: projectId,
                name: "Test Project",
                path: "/test/project",
                addedAt: Date.now()
            })
            .run();
    });

    async function insertPendingRecord(input: IInsertPendingRecordInput): Promise<void> {
        const now = Date.now();
        await databaseClient.db
            .insert(autoFixPullRequests)
            .values({
                id: input.id,
                projectId: input.projectId,
                packageNames: JSON.stringify(input.packageNames),
                fromVersions: JSON.stringify(input.fromVersions),
                toVersions: JSON.stringify(input.toVersions),
                upgradeType: input.upgradeType,
                branchName: input.branchName,
                status: "pending",
                licenseWarnings: input.licenseWarnings
                    ? JSON.stringify(input.licenseWarnings)
                    : null,
                createdAt: now,
                updatedAt: now
            })
            .run();
    }

    function createExecutor(
        overrides: {
            autoFixPrService?: AutoFixPrService.Interface;
            gitService?: GitService.Interface;
            forgeService?: ForgeService.Interface;
            upgradeService?: UpgradeService.Interface;
            broadcaster?: WebSocketBroadcaster.Interface;
        } = {}
    ): {
        executor: AutoFixPrJobExecutor.Interface;
        gitService: GitService.Interface;
        forgeService: ForgeService.Interface;
        upgradeService: UpgradeService.Interface;
        autoFixPrService: AutoFixPrService.Interface;
        broadcaster: WebSocketBroadcaster.Interface;
    } {
        const autoFixPrService = overrides.autoFixPrService ?? createStubAutoFixPrService();
        const gitService = overrides.gitService ?? createStubGitService();
        const forgeService = overrides.forgeService ?? createStubForgeService();
        const upgradeService = overrides.upgradeService ?? createStubUpgradeService();
        const broadcaster = overrides.broadcaster ?? createStubBroadcaster();

        const container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.registerInstance(AutoFixPrService, autoFixPrService);
        container.registerInstance(GitService, gitService);
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(UpgradeService, upgradeService);
        container.register(AutoFixPrJobExecutorRegistration);

        const executor = container.resolve(AutoFixPrJobExecutor);

        return {
            executor,
            gitService,
            forgeService,
            upgradeService,
            autoFixPrService,
            broadcaster
        };
    }

    it("has type 'auto-fix-pr'", () => {
        const { executor } = createExecutor();
        expect(executor.type).toBe("auto-fix-pr");
    });

    it("happy path: creates branch, upgrades package, commits, pushes, creates PR, and marks record created", async () => {
        await insertPendingRecord({
            id: "record-1",
            projectId,
            packageNames: ["lodash"],
            fromVersions: { lodash: "4.0.0" },
            toVersions: { lodash: "4.17.21" },
            upgradeType: "minor",
            branchName: "auto-fix/lodash-4.17.21"
        });

        const { executor, gitService, upgradeService, forgeService } = createExecutor();

        await executor.execute(createMockContext(projectId));

        expect(gitService.createAndCheckoutBranch).toHaveBeenCalledWith(
            "/test/project",
            "auto-fix/lodash-4.17.21"
        );
        expect(upgradeService.upgradePackage).toHaveBeenCalledWith(
            "/test/project",
            "lodash",
            "4.17.21",
            "yarn",
            expect.any(Function),
            expect.anything()
        );
        expect(gitService.stageAll).toHaveBeenCalledWith("/test/project");
        expect(gitService.commit).toHaveBeenCalledWith(
            "/test/project",
            "fix(deps): upgrade lodash to 4.17.21"
        );
        expect(gitService.push).toHaveBeenCalledWith(
            "/test/project",
            "origin",
            "auto-fix/lodash-4.17.21"
        );
        expect(forgeService.createPr).toHaveBeenCalledWith(
            expect.objectContaining({
                head: "auto-fix/lodash-4.17.21",
                base: "main"
            })
        );

        const rows = await databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.id, "record-1"))
            .all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.status).toBe("created");
        expect(rows[0]!.prUrl).toBe("https://github.com/org/repo/pull/1");
        expect(rows[0]!.prNumber).toBe(1);

        expect(gitService.checkout).toHaveBeenCalledWith("/test/project", "main");
    });

    it("failure recovery: upgradePackage throws marks record failed and restores original branch", async () => {
        await insertPendingRecord({
            id: "record-1",
            projectId,
            packageNames: ["lodash"],
            fromVersions: { lodash: "4.0.0" },
            toVersions: { lodash: "4.17.21" },
            upgradeType: "minor",
            branchName: "auto-fix/lodash-4.17.21"
        });

        const upgradeService = createStubUpgradeService({
            upgradePackage: vi.fn(async () => {
                throw new Error("upgrade failed");
            })
        });

        const { executor, gitService } = createExecutor({ upgradeService });

        await executor.execute(createMockContext(projectId));

        const rows = await databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.id, "record-1"))
            .all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.status).toBe("failed");

        expect(gitService.checkout).toHaveBeenCalledWith("/test/project", "main");
        expect(gitService.commit).not.toHaveBeenCalled();
        expect(gitService.push).not.toHaveBeenCalled();
    });

    it("dirty working tree: throws before processing any records", async () => {
        await insertPendingRecord({
            id: "record-1",
            projectId,
            packageNames: ["lodash"],
            fromVersions: { lodash: "4.0.0" },
            toVersions: { lodash: "4.17.21" },
            upgradeType: "minor",
            branchName: "auto-fix/lodash-4.17.21"
        });

        const gitService = createStubGitService({
            getStatus: vi.fn(async () => [" M src/file.ts"])
        });

        const { executor } = createExecutor({ gitService });

        await expect(executor.execute(createMockContext(projectId))).rejects.toThrow(
            /working tree is dirty/i
        );

        expect(gitService.createAndCheckoutBranch).not.toHaveBeenCalled();

        const rows = await databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.id, "record-1"))
            .all();
        expect(rows[0]!.status).toBe("pending");
    });

    it("broadcasts auto-fix:complete with correct counts", async () => {
        await insertPendingRecord({
            id: "record-1",
            projectId,
            packageNames: ["lodash"],
            fromVersions: { lodash: "4.0.0" },
            toVersions: { lodash: "4.17.21" },
            upgradeType: "minor",
            branchName: "auto-fix/lodash-4.17.21"
        });
        await insertPendingRecord({
            id: "record-2",
            projectId,
            packageNames: ["chalk"],
            fromVersions: { chalk: "4.0.0" },
            toVersions: { chalk: "5.0.0" },
            upgradeType: "major",
            branchName: "auto-fix/chalk-5.0.0"
        });

        const upgradeService = createStubUpgradeService({
            upgradePackage: vi.fn(async (_projectPath, packageName) => {
                if (packageName === "chalk") {
                    throw new Error("upgrade failed");
                }
            })
        });

        const { executor, broadcaster } = createExecutor({ upgradeService });

        await executor.execute(createMockContext(projectId));

        expect(broadcaster.broadcast).toHaveBeenCalledWith("auto-fix:complete", {
            projectId,
            created: 1,
            skipped: 0,
            failed: 1
        });
    });

    it("multi-package group: both packages upgraded in same branch with a single commit", async () => {
        await insertPendingRecord({
            id: "record-1",
            projectId,
            packageNames: ["lodash", "chalk"],
            fromVersions: { lodash: "4.0.0", chalk: "4.0.0" },
            toVersions: { lodash: "4.17.21", chalk: "5.0.0" },
            upgradeType: "mixed",
            branchName: "auto-fix/all-upgrades"
        });

        const { executor, gitService, upgradeService } = createExecutor();

        await executor.execute(createMockContext(projectId));

        expect(gitService.createAndCheckoutBranch).toHaveBeenCalledTimes(1);
        expect(upgradeService.upgradePackage).toHaveBeenCalledTimes(2);
        expect(upgradeService.upgradePackage).toHaveBeenCalledWith(
            "/test/project",
            "lodash",
            "4.17.21",
            "yarn",
            expect.any(Function),
            expect.anything()
        );
        expect(upgradeService.upgradePackage).toHaveBeenCalledWith(
            "/test/project",
            "chalk",
            "5.0.0",
            "yarn",
            expect.any(Function),
            expect.anything()
        );
        expect(gitService.commit).toHaveBeenCalledTimes(1);
        expect(gitService.commit).toHaveBeenCalledWith(
            "/test/project",
            "fix(deps): upgrade 2 packages (mixed)"
        );

        const rows = await databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.id, "record-1"))
            .all();
        expect(rows[0]!.status).toBe("created");
    });

    it("returns early with zero counts when there are no pending records", async () => {
        const { executor, broadcaster, gitService } = createExecutor();

        await executor.execute(createMockContext(projectId));

        expect(broadcaster.broadcast).toHaveBeenCalledWith("auto-fix:complete", {
            projectId,
            created: 0,
            skipped: 0,
            failed: 0
        });
        expect(gitService.getStatus).not.toHaveBeenCalled();
    });
});
