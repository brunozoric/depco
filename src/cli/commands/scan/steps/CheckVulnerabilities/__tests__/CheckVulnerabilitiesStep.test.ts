import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { CheckVulnerabilitiesStep } from "../abstractions/CheckVulnerabilitiesStep.js";
import { AuditParserService } from "#shared/vulnerabilities/abstractions/AuditParserService.js";
import { OsvQueryService } from "#shared/vulnerabilities/abstractions/OsvQueryService.js";
import type { IOsvAdvisory } from "#shared/vulnerabilities/abstractions/OsvQueryService.js";
import { VulnerabilityMerger } from "#shared/vulnerabilities/abstractions/VulnerabilityMerger.js";
import type { IAuditRecord, IMergedVulnerability } from "#shared/vulnerabilities/types.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

const { execSyncMock } = vi.hoisted(() => ({ execSyncMock: vi.fn() }));

vi.mock("node:child_process", () => ({
    execSync: execSyncMock
}));

function createTestContext(overrides?: Partial<IStepContext>): IStepContext {
    const results = new Map<string, unknown>();
    results.set("packageManager", "npm");
    results.set("packages", [
        { name: "lodash", version: "4.17.20" },
        { name: "express", version: "4.18.0" }
    ]);
    results.set("config", {
        scan: {
            vulnerability: { ignoredPackages: [] }
        }
    });
    return {
        dataDirectory: "/tmp/test-project",
        envFilePath: ".env",
        options: { check: "vulnerability" },
        results,
        ...overrides
    };
}

function createMockAuditParser(records: IAuditRecord[] = []): AuditParserService.Interface {
    return { parse: vi.fn().mockReturnValue(records) };
}

function createMockOsvQuery(
    queryBatch: () => Promise<Map<string, IOsvAdvisory[]>>
): OsvQueryService.Interface {
    return { queryBatch: vi.fn(queryBatch) };
}

function createMockMerger(result: IMergedVulnerability[] = []): VulnerabilityMerger.Interface {
    return { merge: vi.fn().mockReturnValue(result) };
}

function makeMergedVulnerability(
    overrides: Partial<IMergedVulnerability> = {}
): IMergedVulnerability {
    return {
        packageName: "lodash",
        installedVersion: "4.17.20",
        severity: "high",
        title: "Prototype Pollution",
        advisoryUrl: null,
        cveId: "CVE-2024-1234",
        dedupKey: "CVE-2024-1234",
        vulnerableRange: "<4.17.21",
        fixVersion: "4.17.21",
        source: "audit",
        ...overrides
    };
}

describe("CheckVulnerabilitiesStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        execSyncMock.mockReset();
        execSyncMock.mockReturnValue("{}");
        container = createTestCliContainer();
    });

    it("stores merged vulnerabilities in context.results", async () => {
        const auditRecords: IAuditRecord[] = [
            {
                packageName: "lodash",
                severity: "high",
                title: "Prototype Pollution",
                advisoryUrl: null,
                cveId: "CVE-2024-1234",
                vulnerableRange: "<4.17.21",
                fixVersion: "4.17.21"
            }
        ];
        const mergedVulnerabilities = [makeMergedVulnerability()];

        container.registerInstance(AuditParserService, createMockAuditParser(auditRecords));
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => new Map())
        );
        container.registerInstance(VulnerabilityMerger, createMockMerger(mergedVulnerabilities));

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        expect(context.results.get("vulnerabilities")).toEqual(mergedVulnerabilities);
    });

    it("skips when --check is license only", async () => {
        container.registerInstance(AuditParserService, createMockAuditParser());
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => new Map())
        );
        container.registerInstance(VulnerabilityMerger, createMockMerger());

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        context.options = { check: "license" };

        const result = await step.execute(context);

        expect(result.skipped).toBe(true);
        expect(execSyncMock).not.toHaveBeenCalled();
        expect(context.results.has("vulnerabilities")).toBe(false);
    });

    it("filters ignored packages from results", async () => {
        const mergedVulnerabilities = [
            makeMergedVulnerability({ packageName: "lodash" }),
            makeMergedVulnerability({ packageName: "express", dedupKey: "CVE-2024-5678" }),
            makeMergedVulnerability({ packageName: "safe-pkg", dedupKey: "CVE-2024-9999" })
        ];

        container.registerInstance(AuditParserService, createMockAuditParser());
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => new Map())
        );
        container.registerInstance(VulnerabilityMerger, createMockMerger(mergedVulnerabilities));

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        context.results.set("config", {
            scan: {
                vulnerability: { ignoredPackages: ["lodash"] },
                ignoredPackages: ["express"]
            }
        });

        const result = await step.execute(context);
        const stored = context.results.get("vulnerabilities") as IMergedVulnerability[];

        expect(result.success).toBe(true);
        expect(stored.map(v => v.packageName)).toEqual(["safe-pkg"]);
    });

    it("handles audit failure gracefully and continues with OSV only", async () => {
        execSyncMock.mockImplementation(() => {
            throw new Error("audit command failed");
        });

        const auditParser = createMockAuditParser();
        const osvAdvisories = new Map<string, IOsvAdvisory[]>([
            [
                "lodash@4.17.20",
                [
                    {
                        id: "GHSA-1234",
                        summary: "Prototype Pollution",
                        severity: "high",
                        aliases: ["CVE-2024-1234"],
                        advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                        vulnerableRange: "<4.17.21",
                        fixVersion: "4.17.21"
                    }
                ]
            ]
        ]);
        const merger = createMockMerger([makeMergedVulnerability({ source: "osv" })]);

        container.registerInstance(AuditParserService, auditParser);
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => osvAdvisories)
        );
        container.registerInstance(VulnerabilityMerger, merger);

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        expect(auditParser.parse).not.toHaveBeenCalled();
        expect(merger.merge).toHaveBeenCalledWith(
            expect.objectContaining({ auditRecords: [], osvAdvisories })
        );
        expect(context.results.get("vulnerabilities")).toEqual([
            makeMergedVulnerability({ source: "osv" })
        ]);
    });

    it("handles OSV failure gracefully and continues with audit only", async () => {
        execSyncMock.mockReturnValue("{}");

        const auditRecords: IAuditRecord[] = [
            {
                packageName: "lodash",
                severity: "high",
                title: "Prototype Pollution",
                advisoryUrl: null,
                cveId: "CVE-2024-1234",
                vulnerableRange: "<4.17.21",
                fixVersion: "4.17.21"
            }
        ];
        const auditParser = createMockAuditParser(auditRecords);
        const merger = createMockMerger([makeMergedVulnerability({ source: "audit" })]);

        container.registerInstance(AuditParserService, auditParser);
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => {
                throw new Error("network error");
            })
        );
        container.registerInstance(VulnerabilityMerger, merger);

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        expect(merger.merge).toHaveBeenCalledWith(
            expect.objectContaining({ auditRecords, osvAdvisories: new Map() })
        );
        expect(context.results.get("vulnerabilities")).toEqual([
            makeMergedVulnerability({ source: "audit" })
        ]);
    });

    it("returns failure when both sources fail", async () => {
        execSyncMock.mockImplementation(() => {
            throw new Error("audit command failed");
        });

        container.registerInstance(AuditParserService, createMockAuditParser());
        container.registerInstance(
            OsvQueryService,
            createMockOsvQuery(async () => {
                throw new Error("network error");
            })
        );
        container.registerInstance(VulnerabilityMerger, createMockMerger());

        const step = container.resolve(CheckVulnerabilitiesStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(false);
        expect(context.results.has("vulnerabilities")).toBe(false);
    });
});
