import { describe, it, expect } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
    appSettings,
    pmSecuritySettings,
    projects,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";
import { BackupUseCasesFeature } from "../feature.js";
import { ExportBackupUseCase } from "../abstractions/ExportBackupUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ExportBackupUseCase.Interface;
}

function createThrowingDatabaseClient(message: string): DatabaseClient.Interface {
    return {
        db: {
            select: () => {
                throw new Error(message);
            }
        } as unknown as DatabaseClient.Interface["db"]
    };
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    BackupUseCasesFeature.register(container);

    return { container, db, useCase: container.resolve(ExportBackupUseCase) };
}

describe("ExportBackupUseCase", () => {
    it("exports app settings, security settings, projects, dependencies, and registry cache", async () => {
        const { useCase, db } = createContext();
        const now = Date.now();

        await db.insert(appSettings).values({ key: "branch_template", value: "auto-fix" }).run();
        await db
            .insert(pmSecuritySettings)
            .values({
                id: "sec-1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmMinimalAgeGate",
                expectedValue: "0"
            })
            .run();
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "Project One",
                path: "/repo/project-1",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: now
            })
            .run();
        await db
            .insert(dependencies)
            .values({
                id: "dep-1",
                name: "react",
                repoUrl: "https://github.com/facebook/react",
                createdAt: now
            })
            .run();
        await db
            .insert(dependencyVersions)
            .values({ id: "ver-1", dependencyId: "dep-1", version: "18.2.0", publishedAt: now })
            .run();
        await db
            .insert(changelogs)
            .values({
                id: "changelog-1",
                dependencyId: "dep-1",
                dependencyVersionId: "ver-1",
                content: "Release notes",
                source: "github-releases",
                fetchedAt: now
            })
            .run();
        await db
            .insert(registryCache)
            .values({ packageName: "react", data: "{}", cachedAt: now })
            .run();

        const result = await useCase.execute();

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }

        expect(result.value.version).toBe(1);
        expect(result.value.appSettings).toEqual([{ key: "branch_template", value: "auto-fix" }]);
        expect(result.value.securitySettings).toEqual([
            {
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmMinimalAgeGate",
                expectedValue: "0"
            }
        ]);
        expect(result.value.projects).toEqual([
            {
                name: "Project One",
                path: "/repo/project-1",
                packageManager: "yarn",
                pmVersion: "4.0.0"
            }
        ]);
        expect(result.value.dependencies).toEqual([
            {
                name: "react",
                repoUrl: "https://github.com/facebook/react",
                versions: [
                    {
                        version: "18.2.0",
                        publishedAt: now,
                        changelog: { content: "Release notes", source: "github-releases" }
                    }
                ]
            }
        ]);
        expect(result.value.registryCache).toEqual([
            { packageName: "react", data: "{}", cachedAt: now }
        ]);
    });

    it("exports empty collections when the database has no data", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.appSettings).toEqual([]);
            expect(result.value.securitySettings).toEqual([]);
            expect(result.value.projects).toEqual([]);
            expect(result.value.dependencies).toEqual([]);
            expect(result.value.registryCache).toEqual([]);
        }
    });

    it("exports multiple dependencies with multiple versions and mixed changelogs", async () => {
        const { useCase, db } = createContext();
        const now = Date.now();

        await db
            .insert(dependencies)
            .values([
                {
                    id: "dep-a",
                    name: "react",
                    repoUrl: "https://github.com/facebook/react",
                    createdAt: now
                },
                {
                    id: "dep-b",
                    name: "lodash",
                    repoUrl: "https://github.com/lodash/lodash",
                    createdAt: now
                }
            ])
            .run();
        await db
            .insert(dependencyVersions)
            .values([
                { id: "ver-a1", dependencyId: "dep-a", version: "18.2.0", publishedAt: now },
                { id: "ver-a2", dependencyId: "dep-a", version: "18.3.0", publishedAt: now + 1000 },
                { id: "ver-b1", dependencyId: "dep-b", version: "4.17.21", publishedAt: now }
            ])
            .run();
        await db
            .insert(changelogs)
            .values([
                {
                    id: "cl-a1",
                    dependencyId: "dep-a",
                    dependencyVersionId: "ver-a1",
                    content: "React 18.2 notes",
                    source: "github-releases",
                    fetchedAt: now
                },
                {
                    id: "cl-b1",
                    dependencyId: "dep-b",
                    dependencyVersionId: "ver-b1",
                    content: "Lodash patch notes",
                    source: "changelog-file",
                    fetchedAt: now
                }
            ])
            .run();

        const result = await useCase.execute();

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }

        const deps = result.value.dependencies;
        expect(deps).toHaveLength(2);

        const reactDep = deps.find(dep => dep.name === "react")!;
        expect(reactDep.versions).toHaveLength(2);
        const v182 = reactDep.versions.find(version => version.version === "18.2.0")!;
        expect(v182.changelog).toEqual({ content: "React 18.2 notes", source: "github-releases" });
        const v183 = reactDep.versions.find(version => version.version === "18.3.0")!;
        expect(v183.changelog).toBeUndefined();

        const lodashDep = deps.find(dep => dep.name === "lodash")!;
        expect(lodashDep.versions).toHaveLength(1);
        expect(lodashDep.versions[0]!.changelog).toEqual({
            content: "Lodash patch notes",
            source: "changelog-file"
        });
    });

    it("fails with 500 when the database throws", async () => {
        const { container } = createContext();
        container.registerInstance(DatabaseClient, createThrowingDatabaseClient("disk full"));
        const useCase = container.resolve(ExportBackupUseCase);

        const result = await useCase.execute();

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
