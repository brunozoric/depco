import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { LicenseCheckerService } from "../../abstractions/LicenseCheckerService.js";
import { LicensePolicyService } from "../../abstractions/LicensePolicyService.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { EventBus } from "../../abstractions/EventBus.js";
import { projects, licenses, licenseSnapshots } from "#api/db/schema.js";
import { LicenseScanJobExecutor } from "../abstractions/LicenseScanJobExecutor.js";
import { LicenseScanJobExecutor as LicenseScanJobExecutorRegistration } from "../LicenseScanJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

function createStubLicenseCheckerService(
    records: LicenseCheckerService.LicenseRecord[] = []
): LicenseCheckerService.Interface {
    return {
        scan: vi.fn(async () => records)
    };
}

function createStubLicensePolicyService(
    complianceStatus: LicensePolicyService.ComplianceStatus = {
        total: 0,
        allowed: 0,
        warned: 0,
        denied: 0
    }
): LicensePolicyService.Interface {
    return {
        evaluate: vi.fn(async () => []),
        getComplianceStatus: vi.fn(async () => complianceStatus)
    };
}

function createStubWebSocketBroadcaster(): WebSocketBroadcaster.Interface {
    return {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn()
    };
}

function createStubEventBus(): EventBus.Interface {
    return {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    };
}

interface ICreateExecutorInput {
    licenseCheckerService?: LicenseCheckerService.Interface;
    licensePolicyService?: LicensePolicyService.Interface;
    webSocketBroadcaster?: WebSocketBroadcaster.Interface;
    eventBus?: EventBus.Interface;
}

describe("LicenseScanJobExecutor", () => {
    let testDir: string;
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `license-scan-job-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        db = await createTestDb();
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function createExecutor(input: ICreateExecutorInput = {}): LicenseScanJobExecutor.Interface {
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(
            LicenseCheckerService,
            input.licenseCheckerService ?? createStubLicenseCheckerService()
        );
        container.registerInstance(
            LicensePolicyService,
            input.licensePolicyService ?? createStubLicensePolicyService()
        );
        container.registerInstance(
            WebSocketBroadcaster,
            input.webSocketBroadcaster ?? createStubWebSocketBroadcaster()
        );
        container.registerInstance(EventBus, input.eventBus ?? createStubEventBus());

        container.register(LicenseScanJobExecutorRegistration);

        return container.resolve(LicenseScanJobExecutor);
    }

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "project-1",
            projectPath: testDir,
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
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
    }

    async function insertLicense(
        overrides: Partial<typeof licenses.$inferInsert> = {}
    ): Promise<void> {
        await db
            .insert(licenses)
            .values({
                id: generateId(),
                projectId: "project-1",
                packageName: "left-pad",
                licenseName: "MIT",
                spdxId: "MIT",
                source: "registry",
                riskTier: "low",
                licenseUrl: null,
                scannedAt: Date.now() - 100_000,
                ...overrides
            })
            .run();
    }

    it("calls LicenseCheckerService.scan() with the projectId and packageManager", async () => {
        await insertProject();

        const licenseCheckerService = createStubLicenseCheckerService();
        const executor = createExecutor({ licenseCheckerService });

        await executor.execute(makeContext());

        expect(licenseCheckerService.scan).toHaveBeenCalledWith({
            projectId: "project-1",
            packageManager: "yarn"
        });
    });

    it("upserts license rows from the scan and deletes stale licenses no longer reported", async () => {
        await insertProject();
        await insertLicense({ packageName: "stale-package", spdxId: "ISC" });

        const licenseCheckerService = createStubLicenseCheckerService([
            {
                packageName: "left-pad",
                licenseName: "MIT",
                spdxId: "MIT",
                licenseUrl: "https://example.com/left-pad"
            }
        ]);
        const executor = createExecutor({ licenseCheckerService });

        await executor.execute(makeContext());

        const rows = await db.select().from(licenses).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.packageName).toBe("left-pad");
        expect(rows[0]!.spdxId).toBe("MIT");
        expect(rows[0]!.licenseUrl).toBe("https://example.com/left-pad");
    });

    it("calls LicensePolicyService.evaluate() with the persisted license inputs after the scan", async () => {
        await insertProject();

        const licenseCheckerService = createStubLicenseCheckerService([
            { packageName: "left-pad", licenseName: "MIT", spdxId: "MIT", licenseUrl: null }
        ]);
        const licensePolicyService = createStubLicensePolicyService();
        const executor = createExecutor({ licenseCheckerService, licensePolicyService });

        await executor.execute(makeContext());

        expect(licensePolicyService.evaluate).toHaveBeenCalledTimes(1);
        const [projectIdArg, licenseInputsArg] = (
            licensePolicyService.evaluate as ReturnType<typeof vi.fn>
        ).mock.calls[0]!;
        expect(projectIdArg).toBe("project-1");
        expect(licenseInputsArg).toEqual([
            expect.objectContaining({
                packageName: "left-pad",
                spdxId: "MIT",
                licenseName: "MIT"
            })
        ]);
    });

    it("creates a license snapshot with the compliance counts from LicensePolicyService", async () => {
        await insertProject();

        const licenseCheckerService = createStubLicenseCheckerService([
            { packageName: "left-pad", licenseName: "MIT", spdxId: "MIT", licenseUrl: null }
        ]);
        const licensePolicyService = createStubLicensePolicyService({
            total: 5,
            allowed: 3,
            warned: 1,
            denied: 1
        });
        const executor = createExecutor({ licenseCheckerService, licensePolicyService });

        await executor.execute(makeContext());

        const snapshots = await db.select().from(licenseSnapshots).all();
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]!.projectId).toBe("project-1");
        expect(snapshots[0]!.totalPackages).toBe(5);
        expect(snapshots[0]!.compliantCount).toBe(3);
        expect(snapshots[0]!.warnedCount).toBe(1);
        expect(snapshots[0]!.deniedCount).toBe(1);
    });

    it("broadcasts license-scan:complete over the WebSocket with total license count", async () => {
        await insertProject();

        const licenseCheckerService = createStubLicenseCheckerService([
            { packageName: "left-pad", licenseName: "MIT", spdxId: "MIT", licenseUrl: null },
            { packageName: "is-odd", licenseName: "MIT", spdxId: "MIT", licenseUrl: null }
        ]);
        const webSocketBroadcaster = createStubWebSocketBroadcaster();
        const executor = createExecutor({ licenseCheckerService, webSocketBroadcaster });

        await executor.execute(makeContext());

        expect(webSocketBroadcaster.broadcast).toHaveBeenCalledWith("license-scan:complete", {
            projectId: "project-1",
            totalLicenses: 2,
            violations: 0
        });
    });

    it("emits license-scan:completed on the EventBus", async () => {
        await insertProject();

        const eventBus = createStubEventBus();
        const executor = createExecutor({ eventBus });

        await executor.execute(makeContext());

        expect(eventBus.emit).toHaveBeenCalledWith("license-scan:completed", "project-1");
    });
});
