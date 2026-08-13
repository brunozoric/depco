import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { writeFile, readFile, rm } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import {
    setupSettingsRouteTest,
    teardownSettingsRouteTest,
    type SettingsRouteTestContext
} from "./settingsTestHelpers.js";

describe("settings routes - pm", () => {
    let ctx: SettingsRouteTestContext;
    let app: FastifyInstance;
    let token: string;

    beforeEach(async () => {
        ctx = await setupSettingsRouteTest();
        ({ app, token } = ctx);
    });

    afterEach(async () => {
        await teardownSettingsRouteTest(ctx);
    });

    describe("GET /api/settings/pm", () => {
        it("returns default install flags for all PMs when no file config", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
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
                    headers: { authorization: `Bearer ${token}` },
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
                    headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
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
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/settings/pm/invalid",
                payload: { upgradeStrategy: "caret" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("rejects invalid upgradeStrategy value", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/settings/pm/yarn",
                payload: { upgradeStrategy: "invalid" }
            });

            expect(response.statusCode).toBe(400);
        });

        it("returns updated PM config after write", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
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
