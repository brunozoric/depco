import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { SecurityService } from "#api/services/Security/index.js";
import { CreateProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

function createPackageManagerServiceStub(): PackageManagerService.Interface {
    return {
        detect: vi.fn(async (): Promise<PackageManagerService.PackageManager> => "yarn"),
        getVersion: vi.fn(async () => "4.17.1"),
        updateVersion: vi.fn(async () => undefined),
        audit: vi.fn(async () => [])
    };
}

function createSecurityServiceStub(): SecurityService.Interface {
    return {
        check: vi.fn(async () => ({ passes: true, checks: {} })),
        getLatest: vi.fn(async () => null),
        getLatestForProjects: vi.fn(async () => new Map())
    };
}

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    container.registerInstance(PackageManagerService, createPackageManagerServiceStub());
    container.registerInstance(SecurityService, createSecurityServiceStub());
    const useCase = container.resolve(CreateProjectUseCase);
    return { useCase, db };
}

describe("CreateProjectUseCase", () => {
    const testDirs: string[] = [];

    afterEach(() => {
        for (const dir of testDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    function createTempProjectDir(name: string): string {
        const dir = join(
            tmpdir(),
            `create-project-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-test-project" }));
        testDirs.push(dir);
        return dir;
    }

    it("registers a new project and returns its data", async () => {
        const { useCase } = setup();
        const projectPath = createTempProjectDir("happy");

        const result = await useCase.execute({ projectPath });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.name).toBe("my-test-project");
        expect(result.value.path).toBe(projectPath);
        expect(result.value.packageManager).toBe("yarn");
        expect(result.value.pmVersion).toBe("4.17.1");
        expect(result.value.lastScannedAt).toBeNull();
        expect(result.value.hasNodeModules).toBe(false);
        expect(result.value.id).toBeDefined();
    });

    it("detects hasNodeModules when a node_modules directory exists", async () => {
        const { useCase } = setup();
        const projectPath = createTempProjectDir("node-modules");
        mkdirSync(join(projectPath, "node_modules"), { recursive: true });

        const result = await useCase.execute({ projectPath });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.hasNodeModules).toBe(true);
        }
    });

    it("fires a security check for the newly registered project without awaiting it", async () => {
        const securityService = createSecurityServiceStub();
        const { container } = createTestApiContainer();
        ProjectsUseCasesFeature.register(container);
        container.registerInstance(PackageManagerService, createPackageManagerServiceStub());
        container.registerInstance(SecurityService, securityService);
        const useCase = container.resolve(CreateProjectUseCase);
        const projectPath = createTempProjectDir("security-check");

        const result = await useCase.execute({ projectPath });

        expect(result.isOk()).toBe(true);
        expect(securityService.check).toHaveBeenCalledWith(
            result.isOk() ? result.value.id : undefined,
            projectPath
        );
    });

    it("returns a registrationFailed error when the project path is already registered", async () => {
        const { useCase } = setup();
        const projectPath = createTempProjectDir("duplicate");

        const first = await useCase.execute({ projectPath });
        expect(first.isOk()).toBe(true);

        const second = await useCase.execute({ projectPath });

        expect(second.isFail()).toBe(true);
        if (second.isFail()) {
            expect(second.error.statusCode).toBe(400);
            expect(second.error.message).toBeTruthy();
        }
    });
});
