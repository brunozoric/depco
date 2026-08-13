import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import {
    setupSettingsRouteTest,
    teardownSettingsRouteTest,
    type SettingsRouteTestContext,
    type TestDb
} from "./settingsTestHelpers.js";

function seedPnpmSecuritySettings(db: TestDb): void {
    db.insert(pmSecuritySettings)
        .values([
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "ignoreScripts",
                expectedValue: "true",
                enabled: 1
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "minimumReleaseAge",
                expectedValue: "4320",
                enabled: 1
            }
        ])
        .run();
}

describe("settings routes - security", () => {
    let ctx: SettingsRouteTestContext;
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;

    beforeEach(async () => {
        ctx = await setupSettingsRouteTest();
        ({ app, db, token } = ctx);
    });

    afterEach(async () => {
        await teardownSettingsRouteTest(ctx);
    });

    describe("GET /api/settings/security", () => {
        it("returns empty list when no settings exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/security"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
        });

        it("returns seeded settings", async () => {
            await seedYarnSecuritySettings(db);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/security"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(4);
            expect(body.total).toBe(4);
        });

        it("returns file-derived rows when file config defines security for a PM", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: { security: { ignoreScripts: "true", strictSsl: "true" } }
                    }
                }),
                "utf-8"
            );

            try {
                // Seed DB with pnpm rows — should be ignored
                await seedPnpmSecuritySettings(db);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/settings/security"
                });

                expect(response.statusCode).toBe(200);
                const body = response.json();
                expect(body.configSource).toBe("file");
                expect(body.fileManagedPms).toEqual(["pnpm"]);

                const pnpmItems = body.items.filter(
                    (i: { packageManager: string }) => i.packageManager === "pnpm"
                );
                expect(pnpmItems).toHaveLength(2);
                expect(pnpmItems.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
                    "ignoreScripts",
                    "strictSsl"
                ]);
                expect(pnpmItems.every((i: { enabled: boolean }) => i.enabled)).toBe(true);
            } finally {
                await rm(configPath, { force: true });
            }
        });

        it("returns DB rows for PMs not in file config", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: { security: { ignoreScripts: "true" } }
                    }
                }),
                "utf-8"
            );

            try {
                await seedYarnSecuritySettings(db);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/settings/security"
                });

                const body = response.json();
                expect(body.fileManagedPms).toEqual(["pnpm"]);

                const yarnItems = body.items.filter(
                    (i: { packageManager: string }) => i.packageManager === "yarn"
                );
                expect(yarnItems.length).toBeGreaterThan(0);
            } finally {
                await rm(configPath, { force: true });
            }
        });

        it("returns configSource error and configError when file has bad JSON", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(configPath, "bad json{{{", "utf-8");

            try {
                await seedYarnSecuritySettings(db);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/settings/security"
                });

                expect(response.statusCode).toBe(200);
                const body = response.json();
                expect(body.configSource).toBe("error");
                expect(body.configError).toBeDefined();
                expect(body.configError.type).toBe("json");
                expect(body.fileManagedPms).toEqual([]);
                expect(body.items).toHaveLength(4); // yarn DB rows
            } finally {
                await rm(configPath, { force: true });
            }
        });

        it("returns configSource db when no file config exists", async () => {
            await seedYarnSecuritySettings(db);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/security"
            });

            const body = response.json();
            expect(body.configSource).toBe("db");
            expect(body.fileManagedPms).toEqual([]);
            expect(body.configError).toBeUndefined();
        });
    });

    describe("POST /api/settings/security", () => {
        it("creates a setting for a known PM and field", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                }
            });

            expect(response.statusCode).toBe(201);
            const body = response.json();
            expect(body.item.packageManager).toBe("yarn");
            expect(body.item.fieldName).toBe("enableScripts");
            expect(body.item.configFile).toBe(".yarnrc.yml");
            expect(body.item.expectedValue).toBe("false");
            expect(body.item.id).toBeDefined();
        });

        it("returns 400 for unknown package manager", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "unknown-pm",
                    fieldName: "foo",
                    expectedValue: "bar"
                }
            });

            expect(response.statusCode).toBe(400);
        });

        it("returns 400 for unknown field name", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "nonExistentField",
                    expectedValue: "bar"
                }
            });

            expect(response.statusCode).toBe(400);
        });

        it("returns 400 for invalid expected value", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "maybe"
                }
            });

            expect(response.statusCode).toBe(400);
        });

        it("returns 409 for duplicate setting", async () => {
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                }
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "true"
                }
            });

            expect(response.statusCode).toBe(409);
        });

        it("creates a setting for npm (ignore-scripts)", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "npm",
                    fieldName: "ignore-scripts",
                    expectedValue: "true"
                }
            });

            expect(response.statusCode).toBe(201);
            const body = response.json();
            expect(body.item.packageManager).toBe("npm");
            expect(body.item.fieldName).toBe("ignore-scripts");
            expect(body.item.configFile).toBe(".npmrc");
            expect(body.item.expectedValue).toBe("true");
        });

        it("creates a setting for pnpm (strictPeerDependencies)", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "pnpm",
                    fieldName: "strictPeerDependencies",
                    expectedValue: "true"
                }
            });

            expect(response.statusCode).toBe(201);
            const body = response.json();
            expect(body.item.packageManager).toBe("pnpm");
            expect(body.item.fieldName).toBe("strictPeerDependencies");
            expect(body.item.configFile).toBe("pnpm-workspace.yaml");
            expect(body.item.expectedValue).toBe("true");
        });
    });

    describe("PUT /api/settings/security/:id", () => {
        it("updates the expected value of an existing setting", async () => {
            const createResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                }
            });
            const { id } = createResponse.json().item;

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: `/api/settings/security/${id}`,
                payload: { expectedValue: "true" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().item.expectedValue).toBe("true");
        });

        it("returns 404 for unknown id", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/settings/security/nonexistent",
                payload: { expectedValue: "true" }
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe("PATCH /api/settings/security/:id/toggle", () => {
        it("toggles an existing setting from enabled to disabled and back", async () => {
            const createResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                }
            });
            const { id } = createResponse.json().item;

            const toggleResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PATCH",
                url: `/api/settings/security/${id}/toggle`
            });

            expect(toggleResponse.statusCode).toBe(200);
            expect(toggleResponse.json().item.enabled).toBe(false);

            const toggleAgainResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PATCH",
                url: `/api/settings/security/${id}/toggle`
            });

            expect(toggleAgainResponse.statusCode).toBe(200);
            expect(toggleAgainResponse.json().item.enabled).toBe(true);

            const listResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/security"
            });
            expect(listResponse.json().items).toHaveLength(1);
        });

        it("returns 404 for unknown id", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PATCH",
                url: "/api/settings/security/nonexistent/toggle"
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe("POST /api/settings/security/reset", () => {
        it("deletes existing settings and creates defaults from registry", async () => {
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "true"
                }
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "yarn" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(4);
            expect(body.total).toBe(4);
            expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
                "approvedGitRepositories",
                "enableScripts",
                "npmMinimalAgeGate",
                "npmPreapprovedPackages"
            ]);
            expect(
                body.items.find((i: { fieldName: string }) => i.fieldName === "enableScripts")
                    .expectedValue
            ).toBe("false");
            expect(
                body.items.find(
                    (i: { fieldName: string }) => i.fieldName === "npmPreapprovedPackages"
                ).expectedValue
            ).toBe("exists");
            expect(
                body.items.find((i: { fieldName: string }) => i.fieldName === "npmMinimalAgeGate")
                    .expectedValue
            ).toBe("3d");
        });

        it("returns 400 for unknown package manager", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "unknown-pm" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("works when no existing settings (creates all defaults)", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "yarn" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().items).toHaveLength(4);
        });

        it("returns default items for npm (4 registry fields) with correct defaults", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "npm" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(4);
            expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
                "audit",
                "ignore-scripts",
                "minimal-age-gate",
                "strict-ssl"
            ]);
            expect(body.items.every((i: { configFile: string }) => i.configFile === ".npmrc")).toBe(
                true
            );
            expect(
                body.items.find((i: { fieldName: string }) => i.fieldName === "ignore-scripts")
                    .expectedValue
            ).toBe("true");
        });

        it("returns default items for pnpm (7 registry fields) with correct defaults", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "pnpm" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(7);
            expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
                "blockExoticSubdeps",
                "ignoreScripts",
                "minimumReleaseAge",
                "minimumReleaseAgeStrict",
                "strictDepBuilds",
                "strictPeerDependencies",
                "strictSsl"
            ]);
        });

        it("replaces existing pnpm settings with defaults on reset", async () => {
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "pnpm",
                    fieldName: "ignoreScripts",
                    expectedValue: "false"
                }
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "pnpm" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(7);
            expect(
                body.items.find((i: { fieldName: string }) => i.fieldName === "ignoreScripts")
                    .expectedValue
            ).toBe("true");
        });
    });
});
