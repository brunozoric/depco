import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { writeFile, readFile, rm } from "node:fs/promises";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfigService.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { settingsRoutes } from "../settings.js";

function seedPnpmSecuritySettings(db: BetterSQLite3Database): void {
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

describe("settings routes", () => {
    let app: FastifyInstance;
    let db: BetterSQLite3Database;

    beforeEach(async () => {
        db = createTestDb();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        container.register(FileConfigService).inSingletonScope();

        app = Fastify();
        await app.register(settingsRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    });

    describe("GET /api/settings/security", () => {
        it("returns empty list when no settings exist", async () => {
            const response = await app.inject({
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
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                }
            });

            const response = await app.inject({
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
                method: "PUT",
                url: `/api/settings/security/${id}`,
                payload: { expectedValue: "true" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().item.expectedValue).toBe("true");
        });

        it("returns 404 for unknown id", async () => {
            const response = await app.inject({
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
                method: "PATCH",
                url: `/api/settings/security/${id}/toggle`
            });

            expect(toggleResponse.statusCode).toBe(200);
            expect(toggleResponse.json().item.enabled).toBe(false);

            const toggleAgainResponse = await app.inject({
                method: "PATCH",
                url: `/api/settings/security/${id}/toggle`
            });

            expect(toggleAgainResponse.statusCode).toBe(200);
            expect(toggleAgainResponse.json().item.enabled).toBe(true);

            const listResponse = await app.inject({
                method: "GET",
                url: "/api/settings/security"
            });
            expect(listResponse.json().items).toHaveLength(1);
        });

        it("returns 404 for unknown id", async () => {
            const response = await app.inject({
                method: "PATCH",
                url: "/api/settings/security/nonexistent/toggle"
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe("POST /api/settings/security/reset", () => {
        it("deletes existing settings and creates defaults from registry", async () => {
            await app.inject({
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "yarn",
                    fieldName: "enableScripts",
                    expectedValue: "true"
                }
            });

            const response = await app.inject({
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
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "unknown-pm" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("works when no existing settings (creates all defaults)", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/settings/security/reset",
                payload: { packageManager: "yarn" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().items).toHaveLength(4);
        });

        it("returns default items for npm (4 registry fields) with correct defaults", async () => {
            const response = await app.inject({
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
                method: "POST",
                url: "/api/settings/security",
                payload: {
                    packageManager: "pnpm",
                    fieldName: "ignoreScripts",
                    expectedValue: "false"
                }
            });

            const response = await app.inject({
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

    describe("GET /api/settings/pm", () => {
        it("returns default install flags for all PMs when no file config", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/api/settings/pm"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("db");
            expect(body.fileManagedPms).toEqual([]);
            expect(body.items.length).toBe(4); // one per PM
            const pnpm = body.items.find(
                (i: { packageManager: string }) => i.packageManager === "pnpm"
            );
            expect(pnpm.installFlags.length).toBe(4);
            expect(
                pnpm.installFlags.every((f: { isFileManaged: boolean }) => !f.isFileManaged)
            ).toBe(true);
            expect(pnpm.general.registryUrl).toBeNull();
            expect(pnpm.general.upgradeStrategy).toBeNull();
        });

        it("returns file-managed flags when file config present", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: {
                            installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true },
                            registryUrl: "https://custom.registry.com",
                            upgradeStrategy: "exact"
                        }
                    }
                }),
                "utf-8"
            );

            try {
                const response = await app.inject({
                    method: "GET",
                    url: "/api/settings/pm"
                });

                const body = response.json();
                expect(body.configSource).toBe("file");
                expect(body.fileManagedPms).toEqual(["pnpm"]);

                const pnpm = body.items.find(
                    (i: { packageManager: string }) => i.packageManager === "pnpm"
                );
                const frozen = pnpm.installFlags.find(
                    (f: { flag: string }) => f.flag === "--frozen-lockfile"
                );
                expect(frozen.enabled).toBe(true);
                expect(frozen.isFileManaged).toBe(true);
                expect(pnpm.general.registryUrl).toBe("https://custom.registry.com");
                expect(pnpm.general.upgradeStrategy).toBe("exact");
            } finally {
                await rm(configPath, { force: true });
            }
        });

        it("returns configSource error and defaults when file has bad JSON", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(configPath, "bad json{{{", "utf-8");

            try {
                const response = await app.inject({
                    method: "GET",
                    url: "/api/settings/pm"
                });

                expect(response.statusCode).toBe(200);
                const body = response.json();
                expect(body.configSource).toBe("error");
                expect(body.configError).toBeDefined();
                expect(body.configError.type).toBe("json");
                expect(body.fileManagedPms).toEqual([]);
                expect(body.items.length).toBe(4);
            } finally {
                await rm(configPath, { force: true });
            }
        });
    });

    describe("PUT /api/settings/pm/:pm", () => {
        it("writes install flags to config file", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/pnpm",
                payload: {
                    installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }
                }
            });

            expect(response.statusCode).toBe(200);

            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.pnpm.installFlags).toEqual({
                "--frozen-lockfile": true,
                "--ignore-scripts": true
            });
        });

        it("writes registryUrl to config file", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/yarn",
                payload: {
                    registryUrl: "https://custom.registry.com"
                }
            });

            expect(response.statusCode).toBe(200);
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.yarn.registryUrl).toBe("https://custom.registry.com");
        });

        it("clears registryUrl from config file when set to empty string", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");

            const setResponse = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/yarn",
                payload: {
                    registryUrl: "https://custom.registry.com"
                }
            });
            expect(setResponse.statusCode).toBe(200);

            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.yarn.registryUrl).toBe("https://custom.registry.com");

            const clearResponse = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/yarn",
                payload: {
                    registryUrl: ""
                }
            });

            expect(clearResponse.statusCode).toBe(200);
            expect(clearResponse.json().item.general.registryUrl).toBeNull();

            const rawAfterClear = JSON.parse(await readFile(configPath, "utf-8"));
            expect(rawAfterClear.pmSettings.yarn.registryUrl).toBeUndefined();
            expect("registryUrl" in rawAfterClear.pmSettings.yarn).toBe(false);
        });

        it("writes upgradeStrategy to config file", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/npm",
                payload: {
                    upgradeStrategy: "exact"
                }
            });

            expect(response.statusCode).toBe(200);
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.npm.upgradeStrategy).toBe("exact");
        });

        it("rejects invalid package manager", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/invalid",
                payload: { upgradeStrategy: "caret" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("rejects invalid upgradeStrategy value", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/yarn",
                payload: { upgradeStrategy: "invalid" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("returns updated PM config after write", async () => {
            const response = await app.inject({
                method: "PUT",
                url: "/api/settings/pm/pnpm",
                payload: {
                    installFlags: { "--frozen-lockfile": true },
                    upgradeStrategy: "tilde"
                }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.item.packageManager).toBe("pnpm");
            expect(body.item.general.upgradeStrategy).toBe("tilde");
        });
    });
});
