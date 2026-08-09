import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { AutoFixPrService } from "#api/services/AutoFix/index.js";
import {
    projects,
    scanResults,
    licenses,
    licensePolicyRules,
    autoFixPullRequests,
    autoFixSettings
} from "#api/db/schema.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

async function createService(databaseClient: DatabaseClient.Interface) {
    const { AutoFixPrServiceImpl } = await import("#api/services/AutoFix/AutoFixPrService.js");
    const { AutoFixSettingsServiceImpl } =
        await import("#api/services/AutoFix/AutoFixSettingsService.js");
    const { LicensePolicyServiceImpl } =
        await import("#api/services/License/LicensePolicyService.js");
    return new AutoFixPrServiceImpl(
        databaseClient,
        new AutoFixSettingsServiceImpl(databaseClient),
        new LicensePolicyServiceImpl(databaseClient)
    );
}

interface IScanResultInput {
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
}

async function insertScanResult(
    databaseClient: DatabaseClient.Interface,
    projectId: string,
    input: IScanResultInput
): Promise<void> {
    await databaseClient.db
        .insert(scanResults)
        .values({
            id: generateId(),
            projectId,
            name: input.name,
            currentVersion: input.currentVersion,
            latestVersion: input.latestVersion,
            latestInRange: input.latestVersion,
            type: "dependencies",
            upgradeType: input.upgradeType,
            scannedAt: Date.now()
        })
        .run();
}

async function insertAutoFixSettings(
    databaseClient: DatabaseClient.Interface,
    projectId: string,
    input: { upgradeTypes: string[]; groupingStrategy: string; branchPrefix?: string }
): Promise<void> {
    const now = Date.now();
    await databaseClient.db
        .insert(autoFixSettings)
        .values({
            id: generateId(),
            projectId,
            enabled: 1,
            upgradeTypes: JSON.stringify(input.upgradeTypes),
            groupingStrategy: input.groupingStrategy,
            branchPrefix: input.branchPrefix ?? "auto-fix/",
            createdAt: now,
            updatedAt: now
        })
        .run();
}

describe("AutoFixPrService", () => {
    let databaseClient: DatabaseClient.Interface;
    const projectId = "project-1";

    beforeEach(async () => {
        databaseClient = await createTestDatabaseClient();
        await databaseClient.db
            .insert(projects)
            .values({
                id: projectId,
                name: "Test Project",
                path: "/test",
                addedAt: Date.now()
            })
            .run();
    });

    it("filters by upgrade type", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-package"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "lodash",
            currentVersion: "4.17.20",
            latestVersion: "4.17.21",
            upgradeType: "patch"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.1.0",
            upgradeType: "minor"
        });

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toHaveLength(1);
        expect(result.pending[0]!.packageNames).toEqual(["lodash"]);
        expect(result.skippedDeny).toEqual([]);
        expect(result.skippedDuplicate).toEqual([]);
    });

    it("blocks a package with a deny license violation", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-package"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "gpl-pkg",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });
        await databaseClient.db
            .insert(licenses)
            .values({
                id: generateId(),
                projectId,
                packageName: "gpl-pkg",
                licenseName: "GPL-3.0",
                spdxId: "GPL-3.0",
                source: "license-checker",
                riskTier: "copyleft",
                scannedAt: Date.now()
            })
            .run();
        await databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "deny",
                licensePattern: "GPL-*",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: "No copyleft",
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toEqual([]);
        expect(result.skippedDeny).toEqual(["gpl-pkg"]);
    });

    it("passes a package with a warn license violation, populating licenseWarnings", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-package"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "lgpl-pkg",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });
        await databaseClient.db
            .insert(licenses)
            .values({
                id: generateId(),
                projectId,
                packageName: "lgpl-pkg",
                licenseName: "LGPL-2.1",
                spdxId: "LGPL-2.1",
                source: "license-checker",
                riskTier: "weak-copyleft",
                scannedAt: Date.now()
            })
            .run();
        await databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "warn",
                licensePattern: "LGPL-*",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: "Requires review",
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.skippedDeny).toEqual([]);
        expect(result.pending).toHaveLength(1);
        expect(result.pending[0]!.packageNames).toEqual(["lgpl-pkg"]);
        expect(result.pending[0]!.licenseWarnings).toHaveLength(1);
        expect(result.pending[0]!.licenseWarnings[0]).toContain("lgpl-pkg");
    });

    it("skips a package that already has an open pull request", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-package"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "lodash",
            currentVersion: "4.17.20",
            latestVersion: "4.17.21",
            upgradeType: "patch"
        });
        const now = Date.now();
        await databaseClient.db
            .insert(autoFixPullRequests)
            .values({
                id: generateId(),
                projectId,
                packageNames: JSON.stringify(["lodash"]),
                fromVersions: JSON.stringify({ lodash: "4.17.19" }),
                toVersions: JSON.stringify({ lodash: "4.17.20" }),
                upgradeType: "patch",
                branchName: "auto-fix/lodash-4.17.20",
                status: "created",
                createdAt: now,
                updatedAt: now
            })
            .run();

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toEqual([]);
        expect(result.skippedDuplicate).toEqual(["lodash"]);
    });

    it("groups per-package: one pending record per package", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-package"
        });
        for (const name of ["a", "b", "c"]) {
            await insertScanResult(databaseClient, projectId, {
                name,
                currentVersion: "1.0.0",
                latestVersion: "1.0.1",
                upgradeType: "patch"
            });
        }

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toHaveLength(3);
        for (const record of result.pending) {
            expect(record.packageNames).toHaveLength(1);
        }
    });

    it("groups per-project: one pending record with all packages", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-project"
        });
        for (const name of ["a", "b", "c"]) {
            await insertScanResult(databaseClient, projectId, {
                name,
                currentVersion: "1.0.0",
                latestVersion: "1.0.1",
                upgradeType: "patch"
            });
        }

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toHaveLength(1);
        expect(result.pending[0]!.packageNames.sort()).toEqual(["a", "b", "c"]);
        expect(result.pending[0]!.branchName).toBe("auto-fix/all-upgrades");
    });

    it("replaces a stale record occupying the same branch instead of throwing", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch"],
            groupingStrategy: "per-project"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "a",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });

        const service = await createService(databaseClient);
        const firstResult = await service.generateForProject(projectId);
        expect(firstResult.pending).toHaveLength(1);
        expect(firstResult.pending[0]!.branchName).toBe("auto-fix/all-upgrades");

        // Simulate the first PR failing, leaving a terminal-status record
        // occupying the static "auto-fix/all-upgrades" branch name.
        await databaseClient.db
            .update(autoFixPullRequests)
            .set({ status: "failed" })
            .where(eq(autoFixPullRequests.id, firstResult.pending[0]!.id))
            .run();

        // A new package becomes eligible before the next run.
        await insertScanResult(databaseClient, projectId, {
            name: "b",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });

        const secondResult = await service.generateForProject(projectId);

        expect(secondResult.pending).toHaveLength(1);
        expect(secondResult.pending[0]!.packageNames.sort()).toEqual(["a", "b"]);
        expect(secondResult.pending[0]!.branchName).toBe("auto-fix/all-upgrades");

        const rows = await databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(eq(autoFixPullRequests.projectId, projectId))
            .all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.status).toBe("pending");
    });

    it("groups per-upgrade-type: separate records for patch and minor", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch", "minor"],
            groupingStrategy: "per-upgrade-type"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "a",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "b",
            currentVersion: "1.0.0",
            latestVersion: "1.0.1",
            upgradeType: "patch"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "c",
            currentVersion: "1.0.0",
            latestVersion: "1.1.0",
            upgradeType: "minor"
        });

        const service = await createService(databaseClient);
        const result = await service.generateForProject(projectId);

        expect(result.pending).toHaveLength(2);
        const patchGroup = result.pending.find(record => record.upgradeType === "patch");
        const minorGroup = result.pending.find(record => record.upgradeType === "minor");
        expect(patchGroup?.packageNames.sort()).toEqual(["a", "b"]);
        expect(minorGroup?.packageNames).toEqual(["c"]);
        expect(patchGroup?.branchName).toBe("auto-fix/patch-upgrades");
        expect(minorGroup?.branchName).toBe("auto-fix/minor-upgrades");
    });

    it("builds a PR body with upgrade table, changelogs, license warnings, and footer", async () => {
        const service = await createService(databaseClient);
        const body = service.buildPrBody(
            [
                {
                    packageName: "lodash",
                    fromVersion: "4.17.20",
                    toVersion: "4.17.21",
                    upgradeType: "patch"
                }
            ],
            [{ packageName: "lodash", version: "4.17.21", content: "Bug fixes" }],
            ["lodash: license MIT flagged for review"]
        );

        expect(body).toContain("## Dependency Upgrade");
        expect(body).toContain("| lodash | 4.17.20 | 4.17.21 | patch |");
        expect(body).toContain("## Changelog");
        expect(body).toContain("Bug fixes");
        expect(body).toContain("## License Warnings");
        expect(body).toContain("- lodash: license MIT flagged for review");
        expect(body).toContain("*Generated by Dependency Manager*");
    });

    it("builds a PR body without a changelog section when no changelogs are given", async () => {
        const service = await createService(databaseClient);
        const body = service.buildPrBody(
            [
                {
                    packageName: "lodash",
                    fromVersion: "4.17.20",
                    toVersion: "4.17.21",
                    upgradeType: "patch"
                }
            ],
            [],
            []
        );

        expect(body).toContain("## Dependency Upgrade");
        expect(body).not.toContain("## Changelog");
        expect(body).not.toContain("## License Warnings");
        expect(body).toContain("*Generated by Dependency Manager*");
    });

    it("returns an empty result when there are no outdated packages", async () => {
        await insertAutoFixSettings(databaseClient, projectId, {
            upgradeTypes: ["patch", "minor", "major"],
            groupingStrategy: "per-package"
        });
        await insertScanResult(databaseClient, projectId, {
            name: "lodash",
            currentVersion: "4.17.21",
            latestVersion: "4.17.21",
            upgradeType: "none"
        });

        const service = await createService(databaseClient);
        const result: AutoFixPrService.GenerateResult = await service.generateForProject(projectId);

        expect(result.pending).toEqual([]);
        expect(result.skippedDeny).toEqual([]);
        expect(result.skippedDuplicate).toEqual([]);
    });
});
