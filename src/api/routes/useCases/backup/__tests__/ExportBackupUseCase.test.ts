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
