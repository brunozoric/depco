import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { writeFile, rm } from "fs/promises";
import { join } from "path";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { registryCache } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { RegistryCacheService } from "../abstractions/RegistryCacheService.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        async run() {
            return {
                stdout: JSON.stringify({
                    "dist-tags": { latest: "19.2.7", next: "19.3.0-canary" },
                    versions: ["19.0.0", "19.1.0", "19.2.7"]
                }),
                stderr: "",
                exitCode: 0
            };
        },
        async runStreaming() {
            return { stdout: "", stderr: "", exitCode: 0 };
        }
    };
}

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

describe("RegistryCacheService", () => {
    let service: RegistryCacheService.Interface;
    let db: TestDb;

    beforeEach(() => {
        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;
        container.registerInstance(CommandRunner, createMockCommandRunner());
        service = container.resolve(RegistryCacheService);
    });

    it("fetches and caches package info", async () => {
        const info = await service.getPackageInfo("react", "yarn");

        expect(info.name).toBe("react");
        expect(info.latestVersion).toBe("19.2.7");
        expect(info.distTags["latest"]).toBe("19.2.7");
    });

    it("returns cached data on second call", async () => {
        await service.getPackageInfo("react", "yarn");

        const cached = await db
            .select()
            .from(registryCache)
            .where(eq(registryCache.packageName, "react"))
            .get();
        expect(cached).toBeDefined();
        expect(cached!.data).toContain("19.2.7");
    });

    it("clears all cache", async () => {
        await service.getPackageInfo("react", "yarn");
        await service.clearAll();

        const all = await db.select().from(registryCache).all();
        expect(all).toHaveLength(0);
    });

    it("clears single package cache", async () => {
        await service.getPackageInfo("react", "yarn");
        await service.clearPackage("react");

        const cached = await db
            .select()
            .from(registryCache)
            .where(eq(registryCache.packageName, "react"))
            .get();
        expect(cached).toBeUndefined();
    });

    it("force=true bypasses cache", async () => {
        await service.getPackageInfo("react", "yarn");
        const info = await service.getPackageInfo("react", "yarn", true);
        expect(info.latestVersion).toBe("19.2.7");
    });

    it("deduplicates concurrent requests for the same package", async () => {
        const runSpy = vi.fn(async () => ({
            stdout: JSON.stringify({
                "dist-tags": { latest: "1.0.0" },
                versions: ["1.0.0"]
            }),
            stderr: "",
            exitCode: 0
        }));
        const { container } = createTestApiContainer();
        container.registerInstance(CommandRunner, {
            run: runSpy,
            async runStreaming() {
                return { stdout: "", stderr: "", exitCode: 0 };
            }
        });
        const dedupService = container.resolve(RegistryCacheService);

        const [first, second] = await Promise.all([
            dedupService.getPackageInfo("dedup-pkg", "yarn"),
            dedupService.getPackageInfo("dedup-pkg", "yarn")
        ]);

        expect(first).toEqual(second);
        expect(runSpy).toHaveBeenCalledTimes(1);
    });

    it("returns cached data when within TTL", async () => {
        const runSpy = vi.fn();
        const { container, db: ttlDb } = createTestApiContainer();
        container.registerInstance(CommandRunner, {
            run: runSpy,
            async runStreaming() {
                return { stdout: "", stderr: "", exitCode: 0 };
            }
        });
        const ttlService = container.resolve(RegistryCacheService);

        await ttlDb.insert(registryCache).values({
            packageName: "cached-pkg",
            data: JSON.stringify({
                name: "cached-pkg",
                latestVersion: "2.0.0",
                distTags: { latest: "2.0.0" },
                versions: ["2.0.0"]
            }),
            cachedAt: Date.now()
        });

        const info = await ttlService.getPackageInfo("cached-pkg", "yarn");

        expect(info.latestVersion).toBe("2.0.0");
        expect(runSpy).not.toHaveBeenCalled();
    });

    it("throws for package names starting with dash", async () => {
        await expect(service.getPackageInfo("-malicious", "yarn")).rejects.toThrow(
            "Invalid package name: -malicious"
        );
    });

    describe("registry URL from file config", () => {
        const configPath = join(process.cwd(), ".dependency-upgrader.json");

        afterEach(async () => {
            await rm(configPath, { force: true });
        });

        it("passes the configured registry URL to the driver's registryInfoCommand", async () => {
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        yarn: { registryUrl: "https://registry.example.com" }
                    }
                }),
                "utf-8"
            );

            const runSpy = vi.fn(async () => ({
                stdout: JSON.stringify({
                    "dist-tags": { latest: "1.0.0" },
                    versions: ["1.0.0"]
                }),
                stderr: "",
                exitCode: 0
            }));
            const { container } = createTestApiContainer();
            container.registerInstance(CommandRunner, {
                run: runSpy,
                async runStreaming() {
                    return { stdout: "", stderr: "", exitCode: 0 };
                }
            });
            const configuredService = container.resolve(RegistryCacheService);

            await configuredService.getPackageInfo("react", "yarn");

            expect(runSpy).toHaveBeenCalledWith(
                "yarn",
                ["npm", "info", "react", "--json", "--registry", "https://registry.example.com"],
                expect.any(Object)
            );
        });

        it("omits the --registry flag when no file config is present", async () => {
            const runSpy = vi.fn(async () => ({
                stdout: JSON.stringify({
                    "dist-tags": { latest: "1.0.0" },
                    versions: ["1.0.0"]
                }),
                stderr: "",
                exitCode: 0
            }));
            const { container } = createTestApiContainer();
            container.registerInstance(CommandRunner, {
                run: runSpy,
                async runStreaming() {
                    return { stdout: "", stderr: "", exitCode: 0 };
                }
            });
            const unconfiguredService = container.resolve(RegistryCacheService);

            await unconfiguredService.getPackageInfo("react", "yarn");

            expect(runSpy).toHaveBeenCalledWith(
                "yarn",
                ["npm", "info", "react", "--json"],
                expect.any(Object)
            );
        });
    });
});
