import { vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import type {
    IVulnerability,
    IVulnerabilityDetail,
    IEnrichedVulnerability,
    IEnrichAndSortOptions
} from "#api/services/Vulnerability/index.js";
import { OsvCacheService } from "#api/services/Vulnerability/index.js";
import type { IOsvEnrichedDetail } from "#api/services/Vulnerability/index.js";
import { projects, vulnerabilities } from "#api/db/schema.js";
import { vulnerabilityRoutes } from "../vulnerabilities.js";

export type TestDb = ReturnType<typeof createTestApiContainer>["db"];

export interface IRouteTestContext {
    app: FastifyInstance;
    db: TestDb;
    token: string;
}

export function makeVulnerability(overrides: Partial<IVulnerability> = {}): IVulnerability {
    return {
        id: generateId(),
        projectId: "proj-1",
        packageName: "lodash",
        severity: "high",
        title: "Prototype pollution",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dedup-1",
        vulnerableRange: "<4.17.21",
        fixVersion: "4.17.21",
        source: "audit",
        dependencyKind: "dependency",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null,
        ...overrides
    };
}

/**
 * Builds the enriched shape enrichAndSort would normally produce for a raw
 * IVulnerability. Used by the mocked VulnerabilityService's default
 * enrichAndSort implementation and by tests that need to assert on specific
 * enrichment fields (projectName, dependencyKind) without exercising the real
 * service's db-backed enrichment logic (covered separately in
 * VulnerabilityService.test.ts).
 */
export function makeEnrichedVulnerability(input: {
    item: IVulnerability;
    projectName: string;
    dependencyKind?: string;
}): IEnrichedVulnerability {
    const { item, projectName, dependencyKind = item.dependencyKind } = input;
    return {
        id: item.id,
        projectId: item.projectId,
        projectName,
        packageName: item.packageName,
        severity: item.severity,
        title: item.title,
        advisoryUrl: item.advisoryUrl,
        cveId: item.cveId,
        vulnerableRange: item.vulnerableRange,
        fixVersion: item.fixVersion,
        source: item.source,
        installedVersion: item.installedVersion,
        dependencyKind,
        scannedAt: item.scannedAt,
        dismissedAt: item.dismissedAt,
        dismissedUntil: item.dismissedUntil,
        dismissedBy: item.dismissedBy
    };
}

export function createMockVulnerabilityService(): VulnerabilityService.Interface {
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
        // Default: enriches with a placeholder projectName/dependencyKind and
        // applies pagination when page+pageSize are given. Tests that assert
        // on specific enrichment content override this per-test.
        enrichAndSort: vi.fn(
            async (input: { items: IVulnerability[]; options?: IEnrichAndSortOptions }) => {
                const { items, options = {} } = input;
                const enriched = items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "Unknown" })
                );
                const total = enriched.length;
                if (options.page !== undefined && options.pageSize !== undefined) {
                    const start = (options.page - 1) * options.pageSize;
                    return { items: enriched.slice(start, start + options.pageSize), total };
                }
                return { items: enriched, total };
            }
        )
    };
}

export function createMockOsvCacheService(): OsvCacheService.Interface {
    return {
        queryBatch: vi.fn(),
        invalidate: vi.fn(),
        getEnrichedDetail: vi.fn(async () => null)
    };
}

export function makeVulnerabilityDetail(
    overrides: Partial<IVulnerabilityDetail> = {}
): IVulnerabilityDetail {
    return {
        ...makeVulnerability(),
        projectName: "my-app",
        ...overrides
    };
}

export function makeOsvEnrichedDetail(
    overrides: Partial<IOsvEnrichedDetail> = {}
): IOsvEnrichedDetail {
    return {
        description: "Prototype pollution vulnerability",
        references: [{ type: "ADVISORY", url: "https://example.com/advisory" }],
        affectedVersions: [{ introduced: "0", fixed: "4.17.21", lastAffected: null }],
        cvssScore: 7.5,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        aliases: ["CVE-2021-0001"],
        ...overrides
    };
}

/**
 * Wires the vulnerability routes with real services (VulnerabilityService,
 * PackageManagerService, OsvCacheService, AuditParserService,
 * PackageManagerDriverRegistry) against an in-memory SQLite DB, mocking only
 * CommandRunner — used by the bulk dismiss/rescan/export route tests, which
 * exercise real filtering/dismiss logic rather than a mocked service.
 */
export async function createTestContext(): Promise<IRouteTestContext> {
    const { container, db } = createTestApiContainer();

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(vulnerabilityRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, db, token };
}

export async function insertTestProject(db: TestDb, id: string): Promise<void> {
    const existing = await db.select().from(projects).where(eq(projects.id, id)).all();
    if (existing.length > 0) {
        return;
    }
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/tmp/${id}`,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

export async function seedVulnerabilities(
    db: TestDb,
    count: number,
    projectId = "project-1"
): Promise<string[]> {
    await insertTestProject(db, projectId);

    const ids = Array.from({ length: count }, () => generateId());
    await db.insert(vulnerabilities).values(
        ids.map((id, index) => ({
            id,
            projectId,
            packageName: `pkg-${index}`,
            severity: "high",
            title: `Issue ${index}`,
            advisoryUrl: null,
            cveId: `CVE-${id}`,
            dedupKey: `CVE-${id}`,
            vulnerableRange: null,
            fixVersion: null,
            source: "audit",
            scannedAt: Date.now()
        }))
    );
    return ids;
}

export async function seedVulnerabilitiesAcrossProjects(
    db: TestDb,
    countByProjectId: Record<string, number>
): Promise<string[]> {
    const ids: string[] = [];
    for (const [projectId, count] of Object.entries(countByProjectId)) {
        ids.push(...(await seedVulnerabilities(db, count, projectId)));
    }
    return ids;
}

export async function seedVulnerabilitiesWithSeverities(
    db: TestDb,
    countBySeverity: Record<string, number>
): Promise<string[]> {
    const projectId = "project-1";
    await insertTestProject(db, projectId);

    const ids: string[] = [];
    for (const [severity, count] of Object.entries(countBySeverity)) {
        for (let index = 0; index < count; index++) {
            const id = generateId();
            ids.push(id);
            await db.insert(vulnerabilities).values({
                id,
                projectId,
                packageName: `pkg-${severity}-${index}`,
                severity,
                title: `Issue ${severity} ${index}`,
                advisoryUrl: null,
                cveId: `CVE-${id}`,
                dedupKey: `CVE-${id}`,
                vulnerableRange: null,
                fixVersion: null,
                source: "audit",
                scannedAt: Date.now()
            });
        }
    }
    return ids;
}
