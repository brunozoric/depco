import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { seedNpmSecuritySettings, VALID_NPMRC } from "#testing/helpers/seedNpmSecuritySettings.js";
import {
    seedPnpmSecuritySettings,
    VALID_PNPM_WORKSPACE_YAML
} from "#testing/helpers/seedPnpmSecuritySettings.js";
import {
    seedBunSecuritySettings,
    VALID_BUNFIG_TOML,
    VALID_BUN_PACKAGE_JSON
} from "#testing/helpers/seedBunSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, securityChecks } from "#api/db/schema.js";
import { SecurityService } from "../abstractions/SecurityService.js";
import { SecurityService as SecurityServiceRegistration } from "../SecurityService.js";

describe("SecurityService", () => {
    let testDir: string;
    let service: SecurityService.Interface;
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sec-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        db = await createTestDb();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.register(SecurityServiceRegistration);
        service = container.resolve(SecurityService);
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("passes when all 4 configured Yarn settings are satisfied", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

        const result = await service.check("p1", testDir);
        expect(result.passes).toBe(true);
        expect(result.checks).toEqual({
            npmPreapprovedPackages: true,
            npmMinimalAgeGate: true,
            enableScripts: true,
            approvedGitRepositories: true
        });
    });

    it("returns { passes: true, checks: {} } when the project's package manager has no settings configured", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "npm",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);

        const result = await service.check("p1", testDir);
        expect(result).toEqual({ passes: true, checks: {} });
    });

    it("returns { passes: true, checks: {} } when the project has no package manager detected", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: testDir, addedAt: Date.now() })
            .run();
        await seedYarnSecuritySettings(db);

        const result = await service.check("p1", testDir);
        expect(result).toEqual({ passes: true, checks: {} });
    });

    it("fails when a configured field is missing from .yarnrc.yml", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);
        writeFileSync(
            join(testDir, ".yarnrc.yml"),
            ["npmPreapprovedPackages: []", "npmMinimalAgeGate: 3d", "enableScripts: false"].join(
                "\n"
            )
        );

        const result = await service.check("p1", testDir);
        expect(result.passes).toBe(false);
        expect(result.checks["approvedGitRepositories"]).toBe(false);
    });

    it("fails when a field's value does not match the expected value", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);
        writeFileSync(
            join(testDir, ".yarnrc.yml"),
            [
                "npmPreapprovedPackages: []",
                "npmMinimalAgeGate: 3d",
                "enableScripts: true",
                "approvedGitRepositories: []"
            ].join("\n")
        );

        const result = await service.check("p1", testDir);
        expect(result.passes).toBe(false);
        expect(result.checks["enableScripts"]).toBe(false);
    });

    it("fails when the config file does not exist", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);

        const result = await service.check("p1", testDir);
        expect(result.passes).toBe(false);
        expect(result.checks).toEqual({
            npmPreapprovedPackages: false,
            npmMinimalAgeGate: false,
            enableScripts: false,
            approvedGitRepositories: false
        });
    });

    it("persists check result to security_checks table as JSON results + passes", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

        await service.check("p1", testDir);

        const rows = await db.select().from(securityChecks).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.projectId).toBe("p1");
        expect(rows[0]!.passes).toBe(1);
        expect(JSON.parse(rows[0]!.results)).toEqual({
            npmPreapprovedPackages: true,
            npmMinimalAgeGate: true,
            enableScripts: true,
            approvedGitRepositories: true
        });
    });

    it("retrieves latest check result", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

        await service.check("p1", testDir);
        const latest = await service.getLatest("p1");
        expect(latest).toBeDefined();
        expect(latest!.passes).toBe(true);
        expect(latest!.checks["enableScripts"]).toBe(true);
    });

    it("returns null when no check has been performed", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: testDir, addedAt: Date.now() })
            .run();

        const latest = await service.getLatest("p1");
        expect(latest).toBeNull();
    });

    it("returns the most recent result when multiple checks exist", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        await seedYarnSecuritySettings(db);

        writeFileSync(join(testDir, ".yarnrc.yml"), "enableScripts: true\n");
        await service.check("p1", testDir);
        await new Promise(resolve => setTimeout(resolve, 5));

        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);
        await service.check("p1", testDir);

        const latest = await service.getLatest("p1");
        expect(latest!.passes).toBe(true);
    });

    describe("npm projects", () => {
        it("passes when all 3 npm settings are satisfied", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);
            writeFileSync(join(testDir, ".npmrc"), VALID_NPMRC);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(true);
            expect(result.checks).toEqual({
                "ignore-scripts": true,
                audit: true,
                "strict-ssl": true
            });
        });

        it("fails when ignore-scripts is missing", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);
            writeFileSync(join(testDir, ".npmrc"), ["audit=true", "strict-ssl=true"].join("\n"));

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks["ignore-scripts"]).toBe(false);
        });

        it("fails when ignore-scripts=false", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);
            writeFileSync(
                join(testDir, ".npmrc"),
                ["ignore-scripts=false", "audit=true", "strict-ssl=true"].join("\n")
            );

            const result = await service.check("p1", testDir);
            expect(result.checks["ignore-scripts"]).toBe(false);
        });

        it("fails when .npmrc does not exist", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks).toEqual({
                "ignore-scripts": false,
                audit: false,
                "strict-ssl": false
            });
        });

        it("handles comments and extra keys", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);
            writeFileSync(
                join(testDir, ".npmrc"),
                [
                    "# comment",
                    "registry=https://registry.npmjs.org",
                    "ignore-scripts=true",
                    "audit=true",
                    "strict-ssl=true"
                ].join("\n")
            );

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(true);
        });

        it("persists npm check to security_checks table", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "npm",
                    addedAt: Date.now()
                })
                .run();
            await seedNpmSecuritySettings(db);
            writeFileSync(join(testDir, ".npmrc"), VALID_NPMRC);

            await service.check("p1", testDir);

            const rows = await db.select().from(securityChecks).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]!.projectId).toBe("p1");
            expect(rows[0]!.passes).toBe(1);
            expect(JSON.parse(rows[0]!.results)).toEqual({
                "ignore-scripts": true,
                audit: true,
                "strict-ssl": true
            });
        });
    });

    describe("pnpm projects", () => {
        it("passes when all pnpm settings are satisfied via pnpm-workspace.yaml", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "pnpm",
                    addedAt: Date.now()
                })
                .run();
            await seedPnpmSecuritySettings(db);
            writeFileSync(join(testDir, "pnpm-workspace.yaml"), VALID_PNPM_WORKSPACE_YAML);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(true);
            expect(result.checks).toEqual({
                ignoreScripts: true,
                strictSsl: true,
                strictPeerDependencies: true,
                minimumReleaseAge: true,
                minimumReleaseAgeStrict: true,
                strictDepBuilds: true,
                blockExoticSubdeps: true
            });
        });

        it("fails when strictPeerDependencies is missing", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "pnpm",
                    addedAt: Date.now()
                })
                .run();
            await seedPnpmSecuritySettings(db);
            writeFileSync(
                join(testDir, "pnpm-workspace.yaml"),
                [
                    "ignoreScripts: true",
                    "strictSsl: true",
                    "minimumReleaseAge: 4320",
                    "minimumReleaseAgeStrict: true",
                    "strictDepBuilds: true",
                    "blockExoticSubdeps: true"
                ].join("\n")
            );

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks["strictPeerDependencies"]).toBe(false);
        });

        it("fails when pnpm-workspace.yaml does not exist", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "pnpm",
                    addedAt: Date.now()
                })
                .run();
            await seedPnpmSecuritySettings(db);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks).toEqual({
                ignoreScripts: false,
                strictSsl: false,
                strictPeerDependencies: false,
                minimumReleaseAge: false,
                minimumReleaseAgeStrict: false,
                strictDepBuilds: false,
                blockExoticSubdeps: false
            });
        });

        it("persists pnpm check to security_checks table", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "pnpm",
                    addedAt: Date.now()
                })
                .run();
            await seedPnpmSecuritySettings(db);
            writeFileSync(join(testDir, "pnpm-workspace.yaml"), VALID_PNPM_WORKSPACE_YAML);

            await service.check("p1", testDir);

            const rows = await db.select().from(securityChecks).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]!.projectId).toBe("p1");
            expect(rows[0]!.passes).toBe(1);
            expect(JSON.parse(rows[0]!.results)).toEqual({
                ignoreScripts: true,
                strictSsl: true,
                strictPeerDependencies: true,
                minimumReleaseAge: true,
                minimumReleaseAgeStrict: true,
                strictDepBuilds: true,
                blockExoticSubdeps: true
            });
        });
    });

    describe("bun projects", () => {
        it("passes when all 3 bun settings are satisfied", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "bun",
                    addedAt: Date.now()
                })
                .run();
            await seedBunSecuritySettings(db);
            writeFileSync(join(testDir, "package.json"), VALID_BUN_PACKAGE_JSON);
            writeFileSync(join(testDir, "bunfig.toml"), VALID_BUNFIG_TOML);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(true);
            expect(result.checks).toEqual({
                trustedDependencies: true,
                "install.exact": true,
                "install.frozen": true
            });
        });

        it("fails when bunfig.toml does not exist", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "bun",
                    addedAt: Date.now()
                })
                .run();
            await seedBunSecuritySettings(db);
            writeFileSync(join(testDir, "package.json"), VALID_BUN_PACKAGE_JSON);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks["install.exact"]).toBe(false);
            expect(result.checks["install.frozen"]).toBe(false);
            expect(result.checks["trustedDependencies"]).toBe(true);
        });

        it("fails when install.exact is false", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "bun",
                    addedAt: Date.now()
                })
                .run();
            await seedBunSecuritySettings(db);
            writeFileSync(join(testDir, "package.json"), VALID_BUN_PACKAGE_JSON);
            writeFileSync(
                join(testDir, "bunfig.toml"),
                ["[install]", "exact = false", "frozen = true"].join("\n")
            );

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks["install.exact"]).toBe(false);
            expect(result.checks["install.frozen"]).toBe(true);
        });

        it("fails when trustedDependencies is missing from package.json", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "bun",
                    addedAt: Date.now()
                })
                .run();
            await seedBunSecuritySettings(db);
            writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test" }));
            writeFileSync(join(testDir, "bunfig.toml"), VALID_BUNFIG_TOML);

            const result = await service.check("p1", testDir);
            expect(result.passes).toBe(false);
            expect(result.checks["trustedDependencies"]).toBe(false);
        });

        it("persists bun check to security_checks table", async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "bun",
                    addedAt: Date.now()
                })
                .run();
            await seedBunSecuritySettings(db);
            writeFileSync(join(testDir, "package.json"), VALID_BUN_PACKAGE_JSON);
            writeFileSync(join(testDir, "bunfig.toml"), VALID_BUNFIG_TOML);

            await service.check("p1", testDir);

            const rows = await db.select().from(securityChecks).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]!.projectId).toBe("p1");
            expect(rows[0]!.passes).toBe(1);
            expect(JSON.parse(rows[0]!.results)).toEqual({
                trustedDependencies: true,
                "install.exact": true,
                "install.frozen": true
            });
        });
    });
});
