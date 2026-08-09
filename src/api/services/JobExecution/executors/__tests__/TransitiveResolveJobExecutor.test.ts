import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { RegistryCacheService } from "../../../RegistryCache/index.js";
import { projects, scanResults } from "#api/db/schema.js";
import { TransitiveResolveJobExecutor } from "../abstractions/TransitiveResolveJobExecutor.js";
import { TransitiveResolveJobExecutor as TransitiveResolveJobExecutorRegistration } from "../TransitiveResolveJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

interface CreateRegistryCacheServiceStubOptions {
    packageInfo?: Record<string, Partial<RegistryCacheService.PackageInfo>>;
    failFor?: string[];
}

function createRegistryCacheServiceStub(
    options: CreateRegistryCacheServiceStubOptions = {}
): RegistryCacheService.Interface {
    const packageInfo = options.packageInfo ?? {};
    const failFor = new Set(options.failFor ?? []);

    return {
        getPackageInfo: vi.fn(async (packageName: string) => {
            if (failFor.has(packageName)) {
                throw new Error(`registry lookup failed for ${packageName}`);
            }

            const override = packageInfo[packageName] ?? {};
            return {
                name: packageName,
                latestVersion: "1.0.0",
                distTags: {},
                versions: ["1.0.0"],
                time: {},
                repoUrl: null,
                repoDirectory: null,
                readme: null,
                license: null,
                ...override
            } satisfies RegistryCacheService.PackageInfo;
        }),
        clearAll: vi.fn(async () => {}),
        clearPackage: vi.fn(async () => {})
    };
}

describe("TransitiveResolveJobExecutor", () => {
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        db = await createTestDb();
    });

    function createBroadcasterStub(): WebSocketBroadcaster.Interface {
        return {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };
    }

    function createExecutor(
        registryCacheService: RegistryCacheService.Interface = createRegistryCacheServiceStub(),
        webSocketBroadcaster: WebSocketBroadcaster.Interface = createBroadcasterStub()
    ): TransitiveResolveJobExecutor.Interface {
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(RegistryCacheService, registryCacheService);
        container.registerInstance(WebSocketBroadcaster, webSocketBroadcaster);
        container.register(TransitiveResolveJobExecutorRegistration);

        return container.resolve(TransitiveResolveJobExecutor);
    }

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "project-1",
            projectPath: "/tmp/project-1",
            packageManager: "yarn",
            packagesJson: "{}",
            project: null,
            appendLog: vi.fn(),
            setProgress: vi.fn(),
            signal: new AbortController().signal,
            ...overrides
        };
    }

    async function insertProject(): Promise<void> {
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "p1",
                path: "/tmp/project-1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
    }

    async function insertScanResult(overrides: Partial<typeof scanResults.$inferInsert>) {
        await db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId: "project-1",
                name: "some-package",
                currentVersion: "1.0.0",
                latestVersion: null,
                latestInRange: null,
                type: "transitive",
                upgradeType: null,
                dependencyKind: "transitive",
                registryResolved: 0,
                scannedAt: Date.now(),
                ...overrides
            })
            .run();
    }

    it("resolves unresolved transitive deps with registry data", async () => {
        await insertProject();
        await insertScanResult({ name: "lodash", currentVersion: "4.17.20" });
        await insertScanResult({ name: "left-pad", currentVersion: "1.0.0" });

        const registryCacheService = createRegistryCacheServiceStub({
            packageInfo: {
                lodash: { latestVersion: "4.17.21" },
                "left-pad": { latestVersion: "1.0.0" }
            }
        });
        const executor = createExecutor(registryCacheService);
        await executor.execute(makeContext());

        const rows = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .all();

        const lodashRow = rows.find(row => row.name === "lodash");
        expect(lodashRow?.latestVersion).toBe("4.17.21");
        expect(lodashRow?.upgradeType).toBe("patch");
        expect(lodashRow?.registryResolved).toBe(1);

        const leftPadRow = rows.find(row => row.name === "left-pad");
        expect(leftPadRow?.latestVersion).toBe("1.0.0");
        expect(leftPadRow?.upgradeType).toBe("none");
        expect(leftPadRow?.registryResolved).toBe(1);

        expect(registryCacheService.getPackageInfo).toHaveBeenCalledTimes(2);
    });

    it("broadcasts transitive-resolve:complete after resolving", async () => {
        await insertProject();
        await insertScanResult({ name: "lodash", currentVersion: "4.17.20" });
        await insertScanResult({ name: "left-pad", currentVersion: "1.0.0" });

        const webSocketBroadcaster = createBroadcasterStub();
        const executor = createExecutor(createRegistryCacheServiceStub(), webSocketBroadcaster);
        await executor.execute(makeContext());

        expect(webSocketBroadcaster.broadcast).toHaveBeenCalledWith("transitive-resolve:complete", {
            projectId: "project-1",
            resolved: 2,
            failed: 0
        });
    });

    it("skips when no unresolved transitive deps exist", async () => {
        await insertProject();
        await insertScanResult({
            name: "lodash",
            currentVersion: "4.17.21",
            latestVersion: "4.17.21",
            upgradeType: "none",
            registryResolved: 1
        });

        const registryCacheService = createRegistryCacheServiceStub();
        const executor = createExecutor(registryCacheService);

        await expect(executor.execute(makeContext())).resolves.toBeUndefined();

        expect(registryCacheService.getPackageInfo).not.toHaveBeenCalled();

        const row = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .get();
        expect(row?.latestVersion).toBe("4.17.21");
        expect(row?.registryResolved).toBe(1);
    });

    it("reports progress during resolution", async () => {
        await insertProject();
        for (let i = 0; i < 5; i++) {
            await insertScanResult({ name: `package-${i}`, currentVersion: "1.0.0" });
        }

        const executor = createExecutor();
        const setProgress = vi.fn();
        await executor.execute(makeContext({ setProgress }));

        expect(setProgress).toHaveBeenCalled();

        const percentValues = setProgress.mock.calls.map(
            (call: unknown[]) => (call[0] as { percent: number }).percent
        );

        for (let i = 1; i < percentValues.length; i++) {
            expect(percentValues[i]).toBeGreaterThanOrEqual(percentValues[i - 1]!);
        }

        expect(percentValues[percentValues.length - 1]).toBe(100);
    });

    it("marks a failing package as resolved without version data while others succeed", async () => {
        await insertProject();
        await insertScanResult({ name: "lodash", currentVersion: "4.17.20" });
        await insertScanResult({ name: "left-pad", currentVersion: "1.0.0" });

        const registryCacheService = createRegistryCacheServiceStub({
            packageInfo: {
                lodash: { latestVersion: "4.17.21" }
            },
            failFor: ["left-pad"]
        });
        const appendLog = vi.fn();
        const executor = createExecutor(registryCacheService);
        await executor.execute(makeContext({ appendLog }));

        const rows = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .all();

        const lodashRow = rows.find(row => row.name === "lodash");
        expect(lodashRow?.registryResolved).toBe(1);
        expect(lodashRow?.latestVersion).toBe("4.17.21");
        expect(lodashRow?.upgradeType).toBe("patch");

        const leftPadRow = rows.find(row => row.name === "left-pad");
        expect(leftPadRow?.registryResolved).toBe(1);
        expect(leftPadRow?.latestVersion).toBeNull();
        expect(leftPadRow?.latestInRange).toBeNull();
        expect(leftPadRow?.upgradeType).toBeNull();

        expect(appendLog).toHaveBeenCalledWith(
            expect.stringContaining("Failed to resolve left-pad")
        );
    });

    it("includes the failed count in the summary log", async () => {
        await insertProject();
        await insertScanResult({ name: "lodash", currentVersion: "4.17.20" });
        await insertScanResult({ name: "left-pad", currentVersion: "1.0.0" });

        const registryCacheService = createRegistryCacheServiceStub({
            failFor: ["left-pad"]
        });
        const appendLog = vi.fn();
        const executor = createExecutor(registryCacheService);
        await executor.execute(makeContext({ appendLog }));

        expect(appendLog).toHaveBeenCalledWith("Resolved 2 transitive dependencies (1 failed).");
    });

    it("should update scannedAt when resolving packages", async () => {
        await insertProject();
        const oldScannedAt = Date.now() - 48 * 3600 * 1000;
        await insertScanResult({
            name: "lodash",
            currentVersion: "4.17.20",
            scannedAt: oldScannedAt
        });

        const registryCacheService = createRegistryCacheServiceStub({
            packageInfo: { lodash: { latestVersion: "4.17.21" } }
        });
        const executor = createExecutor(registryCacheService);
        await executor.execute(makeContext());

        const row = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .get();

        expect(row?.scannedAt).toBeGreaterThan(oldScannedAt);
        expect(row?.scannedAt).toBeGreaterThanOrEqual(oldScannedAt + 48 * 3600 * 1000 - 1000);
    });

    it("should update scannedAt for a package that fails to resolve", async () => {
        await insertProject();
        const oldScannedAt = Date.now() - 48 * 3600 * 1000;
        await insertScanResult({
            name: "left-pad",
            currentVersion: "1.0.0",
            scannedAt: oldScannedAt
        });

        const registryCacheService = createRegistryCacheServiceStub({
            failFor: ["left-pad"]
        });
        const executor = createExecutor(registryCacheService);
        await executor.execute(makeContext());

        const row = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .get();

        expect(row?.registryResolved).toBe(1);
        expect(row?.scannedAt).toBeGreaterThan(oldScannedAt);
    });

    it("includes the failed count in the broadcast", async () => {
        await insertProject();
        await insertScanResult({ name: "lodash", currentVersion: "4.17.20" });
        await insertScanResult({ name: "left-pad", currentVersion: "1.0.0" });

        const registryCacheService = createRegistryCacheServiceStub({
            failFor: ["left-pad"]
        });
        const webSocketBroadcaster = createBroadcasterStub();
        const executor = createExecutor(registryCacheService, webSocketBroadcaster);
        await executor.execute(makeContext());

        expect(webSocketBroadcaster.broadcast).toHaveBeenCalledWith("transitive-resolve:complete", {
            projectId: "project-1",
            resolved: 2,
            failed: 1
        });
    });
});
