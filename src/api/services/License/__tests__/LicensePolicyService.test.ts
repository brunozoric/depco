import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { licensePolicyRules, licenses, projects } from "#api/db/schema.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { LicensePolicyService } from "#api/services/License/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

async function createService(databaseClient: DatabaseClient.Interface) {
    const { LicensePolicyServiceImpl } = await import("#api/services/LicensePolicyService.js");
    return new LicensePolicyServiceImpl(databaseClient);
}

function createLicenseInput(
    packageName: string,
    spdxId: string | null,
    licenseName?: string
): LicensePolicyService.LicenseInput {
    return {
        id: generateId(),
        packageName,
        spdxId,
        licenseName: licenseName ?? spdxId ?? "UNKNOWN"
    };
}

describe("LicensePolicyService", () => {
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

    it("should return no violations when no rules exist", async () => {
        const service = await createService(databaseClient);
        const input = [createLicenseInput("lodash", "MIT")];
        const violations = await service.evaluate(projectId, input);
        expect(violations).toEqual([]);
    });

    it("should match a global deny rule with glob pattern", async () => {
        databaseClient.db
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
        const input = [
            createLicenseInput("gpl-pkg", "GPL-3.0"),
            createLicenseInput("mit-pkg", "MIT")
        ];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toHaveLength(1);
        expect(violations[0]!.packageName).toBe("gpl-pkg");
        expect(violations[0]!.action).toBe("deny");
    });

    it("should respect project-scoped rule over global at same priority", async () => {
        const now = Date.now();
        databaseClient.db
            .insert(licensePolicyRules)
            .values([
                {
                    id: generateId(),
                    action: "deny",
                    licensePattern: "GPL-2.0",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: generateId(),
                    action: "allow",
                    licensePattern: "GPL-2.0",
                    packagePattern: null,
                    projectId: projectId,
                    priority: 10,
                    reason: "Allowed in this project",
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const service = await createService(databaseClient);
        const input = [createLicenseInput("gpl-pkg", "GPL-2.0")];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toEqual([]);
    });

    it("should let higher priority rule win", async () => {
        const now = Date.now();
        databaseClient.db
            .insert(licensePolicyRules)
            .values([
                {
                    id: generateId(),
                    action: "deny",
                    licensePattern: "MIT",
                    packagePattern: null,
                    projectId: null,
                    priority: 5,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: generateId(),
                    action: "allow",
                    licensePattern: "MIT",
                    packagePattern: null,
                    projectId: null,
                    priority: 20,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const service = await createService(databaseClient);
        const input = [createLicenseInput("mit-pkg", "MIT")];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toEqual([]);
    });

    it("should support package-specific exemption", async () => {
        const now = Date.now();
        databaseClient.db
            .insert(licensePolicyRules)
            .values([
                {
                    id: generateId(),
                    action: "deny",
                    licensePattern: "GPL-2.0",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: generateId(),
                    action: "allow",
                    licensePattern: "GPL-2.0",
                    packagePattern: "linux-headers",
                    projectId: null,
                    priority: 20,
                    reason: "Exemption",
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const service = await createService(databaseClient);
        const input = [
            createLicenseInput("linux-headers", "GPL-2.0"),
            createLicenseInput("other-gpl-pkg", "GPL-2.0")
        ];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toHaveLength(1);
        expect(violations[0]!.packageName).toBe("other-gpl-pkg");
    });

    it("should match any license when licensePattern is null, scoped by packagePattern", async () => {
        databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "deny",
                licensePattern: null,
                packagePattern: "internal-tool",
                projectId: null,
                priority: 10,
                reason: "Internal tool is banned regardless of its license",
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const service = await createService(databaseClient);
        const input = [
            createLicenseInput("internal-tool", "MIT"),
            createLicenseInput("other-pkg", "MIT")
        ];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toHaveLength(1);
        expect(violations[0]!.packageName).toBe("internal-tool");
        expect(violations[0]!.action).toBe("deny");
    });

    it("should generate warn violations", async () => {
        databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "warn",
                licensePattern: "LGPL-*",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const service = await createService(databaseClient);
        const input = [createLicenseInput("lgpl-pkg", "LGPL-3.0")];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toHaveLength(1);
        expect(violations[0]!.action).toBe("warn");
    });

    it("should handle OR license expression — most permissive wins", async () => {
        databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "deny",
                licensePattern: "GPL-3.0",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const service = await createService(databaseClient);
        const input = [createLicenseInput("dual-pkg", "(MIT OR GPL-3.0)", "(MIT OR GPL-3.0)")];
        const violations = await service.evaluate(projectId, input);

        expect(violations).toEqual([]);
    });

    it("should resolve OR expressions to the least severe action regardless of component order", async () => {
        const now = Date.now();
        databaseClient.db
            .insert(licensePolicyRules)
            .values([
                {
                    id: generateId(),
                    action: "warn",
                    licensePattern: "LGPL-3.0",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: generateId(),
                    action: "deny",
                    licensePattern: "GPL-3.0",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const service = await createService(databaseClient);

        // "warn" (LGPL) is less severe than "deny" (GPL), so the result must
        // be "warn" no matter which component is listed first in the SPDX
        // OR expression.
        const listedGplFirst = createLicenseInput(
            "dual-pkg-a",
            "(GPL-3.0 OR LGPL-3.0)",
            "(GPL-3.0 OR LGPL-3.0)"
        );
        const listedLgplFirst = createLicenseInput(
            "dual-pkg-b",
            "(LGPL-3.0 OR GPL-3.0)",
            "(LGPL-3.0 OR GPL-3.0)"
        );

        const violations = await service.evaluate(projectId, [listedGplFirst, listedLgplFirst]);

        expect(violations).toHaveLength(2);
        for (const violation of violations) {
            expect(violation.action).toBe("warn");
        }
    });

    it("should return correct compliance status", async () => {
        const now = Date.now();
        databaseClient.db
            .insert(licensePolicyRules)
            .values({
                id: generateId(),
                action: "deny",
                licensePattern: "GPL-*",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: null,
                createdAt: now,
                updatedAt: now
            })
            .run();

        const licenseIds = [generateId(), generateId(), generateId()];
        databaseClient.db
            .insert(licenses)
            .values([
                {
                    id: licenseIds[0]!,
                    projectId,
                    packageName: "mit-pkg",
                    licenseName: "MIT",
                    spdxId: "MIT",
                    source: "license-checker",
                    riskTier: "permissive",
                    scannedAt: now
                },
                {
                    id: licenseIds[1]!,
                    projectId,
                    packageName: "gpl-pkg",
                    licenseName: "GPL-3.0",
                    spdxId: "GPL-3.0",
                    source: "license-checker",
                    riskTier: "copyleft",
                    scannedAt: now
                },
                {
                    id: licenseIds[2]!,
                    projectId,
                    packageName: "isc-pkg",
                    licenseName: "ISC",
                    spdxId: "ISC",
                    source: "license-checker",
                    riskTier: "permissive",
                    scannedAt: now
                }
            ])
            .run();

        const service = await createService(databaseClient);
        const input = [
            { id: licenseIds[0]!, packageName: "mit-pkg", spdxId: "MIT", licenseName: "MIT" },
            {
                id: licenseIds[1]!,
                packageName: "gpl-pkg",
                spdxId: "GPL-3.0",
                licenseName: "GPL-3.0"
            },
            { id: licenseIds[2]!, packageName: "isc-pkg", spdxId: "ISC", licenseName: "ISC" }
        ];
        await service.evaluate(projectId, input);

        const status = await service.getComplianceStatus(projectId);
        expect(status.total).toBe(3);
        expect(status.denied).toBe(1);
        expect(status.allowed).toBe(2);
        expect(status.warned).toBe(0);
    });
});
