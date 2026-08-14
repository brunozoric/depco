import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { FilesystemUseCasesFeature } from "../feature.js";
import { BrowseFilesystemUseCase } from "../abstractions/BrowseFilesystemUseCase.js";

interface ITestContext {
    container: Container;
    useCase: BrowseFilesystemUseCase.Interface;
}

function createContext(): ITestContext {
    const { container } = createTestApiContainer();
    FilesystemUseCasesFeature.register(container);

    return { container, useCase: container.resolve(BrowseFilesystemUseCase) };
}

describe("BrowseFilesystemUseCase", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `browse-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        mkdirSync(join(testDir, "beta"));
        mkdirSync(join(testDir, "alpha"));
        mkdirSync(join(testDir, ".hidden"));
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("returns directories sorted alphabetically, excluding hidden by default", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ path: testDir });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items.map(item => item.name)).toEqual(["alpha", "beta"]);
        expect(result.value?.total).toBe(2);
        expect(result.value?.currentPath).toBe(realpathSync(testDir));
    });

    it("includes hidden directories when showHidden is requested", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ path: testDir, showHidden: "true" });

        expect(result.isOk()).toBe(true);
        expect(result.value?.items.map(item => item.name)).toEqual([".hidden", "alpha", "beta"]);
    });

    it("defaults to process.cwd() when no path is provided", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value?.currentPath).toBe(realpathSync(process.cwd()));
    });

    it("fails with 400 for a path that does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ path: join(testDir, "does-not-exist") });

        expect(result.isFail()).toBe(true);
        expect(result.error?.code).toBe("PATH_NOT_FOUND");
        expect(result.error?.statusCode).toBe(400);
    });

    it("fails with 400 when the resolved path is not a directory", async () => {
        const { useCase } = createContext();
        const filePath = join(testDir, "just-a-file.txt");
        writeFileSync(filePath, "hello", "utf-8");

        const result = await useCase.execute({ path: filePath });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "PATH_NOT_FOUND",
            statusCode: 400,
            message: `Cannot read directory: ${realpathSync(filePath)}`
        });
    });
});
