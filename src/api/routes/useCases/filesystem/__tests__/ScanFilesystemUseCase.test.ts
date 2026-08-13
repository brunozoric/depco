import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { FilesystemUseCasesFeature } from "../feature.js";
import { ScanFilesystemUseCase } from "../abstractions/ScanFilesystemUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ScanFilesystemUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    FilesystemUseCasesFeature.register(container);

    return { container, db, useCase: container.resolve(ScanFilesystemUseCase) };
}

function createProjectDir(basePath: string, name: string): string {
    const dirPath = join(basePath, name);
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(join(dirPath, "package.json"), JSON.stringify({ name }), "utf-8");
    return dirPath;
}

describe("ScanFilesystemUseCase", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `scan-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("scans to depth 1 by default and returns package.json-containing directories", async () => {
        createProjectDir(testDir, "project-a");
        mkdirSync(join(testDir, "not-a-project"));
        const { useCase } = createContext();

        const result = await useCase.execute({ path: testDir, depth: 1 });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items.map(item => item.name)).toEqual(["project-a"]);
        expect(result.value?.mode).toBe("depth");
        expect(result.value?.scannedPath).toBe(realpathSync(testDir));
    });

    it("returns mode=workspaces when the root package.json declares workspaces", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ workspaces: ["packages/*"] }),
            "utf-8"
        );
        mkdirSync(join(testDir, "packages", "app-a"), { recursive: true });
        writeFileSync(join(testDir, "packages", "app-a", "package.json"), "{}", "utf-8");
        const { useCase } = createContext();

        const result = await useCase.execute({ path: testDir, depth: 1 });

        expect(result.isOk()).toBe(true);
        expect(result.value?.mode).toBe("workspaces");
        expect(result.value?.items.map(item => item.name)).toEqual(["app-a"]);
    });

    it("excludes projects already present in the database", async () => {
        const projectPath = createProjectDir(testDir, "project-a");
        createProjectDir(testDir, "project-b");
        const { useCase, db } = createContext();
        await db
            .insert(projects)
            .values({
                id: "existing",
                name: "project-a",
                path: realpathSync(projectPath),
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ path: testDir, depth: 1 });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items.map(item => item.name)).toEqual(["project-b"]);
        expect(result.value?.filteredCount).toBe(1);
    });

    it("fails with 400 for a path that does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ path: join(testDir, "does-not-exist"), depth: 1 });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            statusCode: 400,
            message: `Path does not exist: ${join(testDir, "does-not-exist")}`
        });
    });

    it("fails with 500 when reading existing project paths throws", async () => {
        const brokenDb = {
            select: () => ({
                from: () => ({
                    all: () => {
                        throw new Error("database is locked");
                    }
                })
            })
        } as unknown as TestDb;
        const { container } = createTestApiContainer();
        FilesystemUseCasesFeature.register(container);
        container.registerInstance(DatabaseClient, { db: brokenDb });
        const useCase = container.resolve(ScanFilesystemUseCase);

        const result = await useCase.execute({ path: testDir, depth: 1 });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "database is locked" });
    });
});
