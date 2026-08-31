import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { projects, dependencies, dependencyVersions, changelogs } from "#api/db/schema.js";
import { BackupUseCasesFeature } from "../feature.js";
import { ImportBackupUseCase } from "../abstractions/ImportBackupUseCase.js";
import type { IBackupPayload } from "../backupTypes.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    packageManagerService?: Partial<PackageManagerService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ImportBackupUseCase.Interface;
}

function createPackageManagerServiceStub(
    overrides?: Partial<PackageManagerService.Interface>
): PackageManagerService.Interface {
    return {
        detect: vi.fn(async (): Promise<PackageManagerService.PackageManager> => "yarn"),
        getVersion: vi.fn(async () => "4.0.0"),
        updateVersion: vi.fn(async () => {}),
        audit: vi.fn(async () => []),
        ...overrides
    };
}

function createThrowingDatabaseClient(message: string): DatabaseClient.Interface {
    return {
        db: {
            insert: () => {
                throw new Error(message);
            }
        } as unknown as DatabaseClient.Interface["db"]
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    BackupUseCasesFeature.register(container);
    container.registerInstance(
        PackageManagerService,
        createPackageManagerServiceStub(options.packageManagerService)
    );

    return { container, db, useCase: container.resolve(ImportBackupUseCase) };
}

function createEmptyBackupPayload(overrides: Partial<IBackupPayload> = {}): IBackupPayload {
    return {
        version: 1,
        exportedAt: Date.now(),
        appSettings: [],
        securitySettings: [],
        projects: [],
        dependencies: [],
        registryCache: [],
        ...overrides
    };
}

describe("ImportBackupUseCase", () => {
    let projectDir: string;

    beforeEach(() => {
        projectDir = mkdtempSync(join(tmpdir(), "dependency-upgrader-import-backup-"));
        writeFileSync(
            join(projectDir, "package.json"),
            JSON.stringify({ name: "imported-project" })
        );
    });

    afterEach(() => {
        rmSync(projectDir, { recursive: true, force: true });
    });

    it("imports app settings, security settings, a new project, and dependency history", async () => {
        const { useCase, db } = createContext();
        const payload = createEmptyBackupPayload({
            appSettings: [{ key: "branch_template", value: "auto-fix" }],
            securitySettings: [
                {
                    packageManager: "yarn",
                    configFile: ".yarnrc.yml",
                    fieldName: "npmMinimalAgeGate",
                    expectedValue: "0"
                }
            ],
            projects: [
                {
                    name: "imported-project",
                    path: projectDir,
                    packageManager: "yarn",
                    pmVersion: "4.0.0"
                }
            ],
            dependencies: [
                {
                    name: "react",
                    repoUrl: "https://github.com/facebook/react",
                    versions: [
                        {
                            version: "18.2.0",
                            publishedAt: Date.now(),
                            changelog: { content: "Release notes", source: "github-releases" }
                        }
                    ]
                }
            ],
            registryCache: [{ packageName: "react", data: "{}", cachedAt: Date.now() }]
        });

        const result = await useCase.execute({ payload });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }

        expect(result.value.appSettings).toEqual({ imported: 1, skipped: 0 });
        expect(result.value.securitySettings).toEqual({ imported: 1, skipped: 0 });
        expect(result.value.projects).toEqual({ imported: 1, skipped: 0, failed: 0, errors: [] });
        expect(result.value.registryCache).toEqual({ imported: 1, skipped: 0 });
        expect(result.value.dependencies.imported).toBeGreaterThan(0);

        const importedProject = await db
            .select()
            .from(projects)
            .where(eq(projects.path, projectDir))
            .get();
        expect(importedProject?.name).toBe("imported-project");
    });

    it("skips a project whose path is already registered", async () => {
        const { useCase, db } = createContext();
        await db
            .insert(projects)
            .values({
                id: "existing-project",
                name: "existing",
                path: projectDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
        const payload = createEmptyBackupPayload({
            projects: [
                {
                    name: "imported-project",
                    path: projectDir,
                    packageManager: "yarn",
                    pmVersion: "4.0.0"
                }
            ]
        });

        const result = await useCase.execute({ payload });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projects).toEqual({
                imported: 0,
                skipped: 1,
                failed: 0,
                errors: []
            });
        }
    });

    it("records a failure when the project path does not exist on disk", async () => {
        const { useCase } = createContext();
        const missingPath = join(projectDir, "does-not-exist");
        const payload = createEmptyBackupPayload({
            projects: [
                {
                    name: "ghost-project",
                    path: missingPath,
                    packageManager: "yarn",
                    pmVersion: null
                }
            ]
        });

        const result = await useCase.execute({ payload });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projects.failed).toBe(1);
            expect(result.value.projects.imported).toBe(0);
            expect(result.value.projects.errors[0]).toContain(missingPath);
        }
    });

    it("imports multiple projects with multiple dependencies and versions", async () => {
        const secondProjectDir = mkdtempSync(join(tmpdir(), "dependency-upgrader-import-backup-"));
        writeFileSync(
            join(secondProjectDir, "package.json"),
            JSON.stringify({ name: "second-project" })
        );

        try {
            const { useCase, db } = createContext();
            const now = Date.now();

            const payload = createEmptyBackupPayload({
                projects: [
                    {
                        name: "imported-project",
                        path: projectDir,
                        packageManager: "yarn",
                        pmVersion: "4.0.0"
                    },
                    {
                        name: "second-project",
                        path: secondProjectDir,
                        packageManager: "npm",
                        pmVersion: "10.0.0"
                    }
                ],
                dependencies: [
                    {
                        name: "react",
                        repoUrl: "https://github.com/facebook/react",
                        versions: [
                            {
                                version: "18.2.0",
                                publishedAt: now,
                                changelog: { content: "v18.2 notes", source: "github-releases" }
                            },
                            {
                                version: "18.3.0",
                                publishedAt: now + 1000,
                                changelog: undefined
                            }
                        ]
                    },
                    {
                        name: "lodash",
                        repoUrl: "https://github.com/lodash/lodash",
                        versions: [
                            {
                                version: "4.17.21",
                                publishedAt: now,
                                changelog: { content: "Security patch", source: "changelog-file" }
                            }
                        ]
                    }
                ]
            });

            const result = await useCase.execute({ payload });

            expect(result.isOk()).toBe(true);
            if (!result.isOk()) {
                return;
            }

            expect(result.value.projects.imported).toBe(2);

            const allProjects = db.select().from(projects).all();
            expect(allProjects).toHaveLength(2);

            const allDeps = db.select().from(dependencies).all();
            expect(allDeps).toHaveLength(2);

            const allVersions = db.select().from(dependencyVersions).all();
            expect(allVersions).toHaveLength(3);

            const allChangelogs = db.select().from(changelogs).all();
            expect(allChangelogs).toHaveLength(2);
        } finally {
            rmSync(secondProjectDir, { recursive: true, force: true });
        }
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createContext();
        container.registerInstance(DatabaseClient, createThrowingDatabaseClient("disk full"));
        const useCase = container.resolve(ImportBackupUseCase);
        const payload = createEmptyBackupPayload({
            appSettings: [{ key: "branch_template", value: "auto-fix" }]
        });

        const result = await useCase.execute({ payload });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "disk full"
            });
        }
    });
});
