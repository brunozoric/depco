import { vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import type { VulnerabilitySeverityCounts } from "#shared/vulnerabilities/types.js";
import {
    VulnerabilityService,
    VulnerabilityQueryService,
    OsvCacheService
} from "#api/services/Vulnerability/index.js";

export type TestDb = ReturnType<typeof createTestApiContainer>["db"];

export interface IInsertTestProjectOverrides {
    name?: string;
    packageManager?: string | null;
}

export async function insertTestProject(
    db: TestDb,
    id: string,
    overrides: IInsertTestProjectOverrides = {}
): Promise<void> {
    const packageManager = "packageManager" in overrides ? overrides.packageManager : "yarn";
    await db
        .insert(projects)
        .values({
            id,
            name: overrides.name ?? id,
            path: `/repo/${id}`,
            packageManager,
            addedAt: Date.now()
        })
        .run();
}

export function createVulnerabilityFixture(
    overrides: Partial<VulnerabilityService.Vulnerability> = {}
): VulnerabilityService.Vulnerability {
    return {
        id: "vuln-1",
        projectId: "proj-1",
        packageName: "lodash",
        severity: "high",
        title: "Prototype pollution in lodash",
        advisoryUrl: null,
        cveId: "CVE-2021-1234",
        dedupKey: "dedup-1",
        vulnerableRange: "<4.17.21",
        fixVersion: "4.17.21",
        source: "osv",
        dependencyKind: "dependency",
        installedVersion: "4.17.20",
        scannedAt: 1700000000000,
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null,
        ...overrides
    };
}

export function createVulnerabilityDetailFixture(
    overrides: Partial<VulnerabilityService.VulnerabilityDetail> = {}
): VulnerabilityService.VulnerabilityDetail {
    return {
        ...createVulnerabilityFixture(overrides),
        projectName: "Test Project",
        ...overrides
    };
}

export function createEnrichedVulnerabilityFixture(
    overrides: Partial<VulnerabilityService.EnrichedVulnerability> = {}
): VulnerabilityService.EnrichedVulnerability {
    return {
        id: "vuln-1",
        projectId: "proj-1",
        projectName: "Test Project",
        packageName: "lodash",
        severity: "high",
        title: "Prototype pollution in lodash",
        advisoryUrl: null,
        cveId: "CVE-2021-1234",
        vulnerableRange: "<4.17.21",
        fixVersion: "4.17.21",
        source: "osv",
        installedVersion: "4.17.20",
        dependencyKind: "dependency",
        scannedAt: 1700000000000,
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null,
        ...overrides
    };
}

export function createSeverityCountsFixture(
    overrides: Partial<VulnerabilitySeverityCounts> = {}
): VulnerabilitySeverityCounts {
    return { critical: 0, high: 0, moderate: 0, low: 0, info: 0, ...overrides };
}

export function createVulnerabilityServiceStub(
    overrides: Partial<VulnerabilityService.Interface> = {}
): VulnerabilityService.Interface {
    return {
        scan: vi.fn(),
        getLatest: vi.fn(),
        getAll: vi.fn(),
        getById: vi.fn(),
        getSummary: vi.fn(),
        forceOsvRefresh: vi.fn(),
        bulkDismiss: vi.fn(),
        bulkSnooze: vi.fn(),
        bulkUndismiss: vi.fn(),
        getProjectIdsForVulnerabilityIds: vi.fn(),
        getRecentlyExpiredSnoozes: vi.fn(),
        enrichAndSort: vi.fn(),
        ...overrides
    };
}

export function createVulnerabilityQueryServiceStub(
    overrides: Partial<VulnerabilityQueryService.Interface> = {}
): VulnerabilityQueryService.Interface {
    return {
        listVulnerabilities: vi.fn(),
        listProjectVulnerabilities: vi.fn(),
        getSummary: vi.fn(),
        exportVulnerabilities: vi.fn(),
        ...overrides
    };
}

export function createOsvCacheServiceStub(
    overrides: Partial<OsvCacheService.Interface> = {}
): OsvCacheService.Interface {
    return {
        queryBatch: vi.fn(),
        invalidate: vi.fn(),
        getEnrichedDetail: vi.fn(),
        ...overrides
    };
}
