import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { projects, scanResults } from "#api/db/schema.js";
import { PackagesUseCasesFeature } from "../feature.js";
import { RescanPackageUseCase } from "../abstractions/RescanPackageUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    registryCacheService?: Partial<RegistryCacheService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: RescanPackageUseCase.Interface;
}

function createRegistryCachePackageInfo(
    overrides: Partial<RegistryCacheService.PackageInfo> = {}
): RegistryCacheService.PackageInfo {
    return {
        name: "react",
        latestVersion: "18.2.0",
        distTags: { latest: "18.2.0" },
        versions: ["18.0.0", "18.2.0"],
        time: {},
        repoUrl: null,
        repoDirectory: null,
        readme: null,
        license: null,
        ...overrides
    };
}

function createRegistryCacheServiceStub(
    overrides?: Partial<RegistryCacheService.Interface>
): RegistryCacheService.Interface {
    return {
        getPackageInfo: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        clearAll: vi.fn(async () => {}),
        clearPackage: vi.fn(async () => {}),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    PackagesUseCasesFeature.register(container);
    container.registerInstance(
        RegistryCacheService,
        createRegistryCacheServiceStub(options.registryCacheService)
    );

    return { container, db, useCase: container.resolve(RescanPackageUseCase) };
}

async function insertTestProject(db: TestDb, id: string, packageManager: string): Promise<void> {
    await db
        .insert(projects)
        .values({ id, name: id, path: `/repo/${id}`, packageManager, addedAt: Date.now() })
        .run();
}

async function insertTestScanResult(
    db: TestDb,
    input: { id: string; projectId: string; name: string; currentVersion: string }
): Promise<void> {
    await db
        .insert(scanResults)
        .values({
            id: input.id,
            projectId: input.projectId,
            name: input.name,
            currentVersion: input.currentVersion,
            type: "dependency",
            scannedAt: Date.now()
        })
        .run();
}

describe("RescanPackageUseCase", () => {
    it("returns updated: 0 when the package has no scan results", async () => {
        const getPackageInfo = vi.fn();
        const { useCase } = createContext({ registryCacheService: { getPackageInfo } });

        const result = await useCase.execute({ packageName: "does-not-exist" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ updated: 0 });
        }
        expect(getPackageInfo).not.toHaveBeenCalled();
    });

    it("re-fetches registry info and updates every matching scan result", async () => {
        const getPackageInfo = vi.fn(async () => createRegistryCachePackageInfo());
        const { useCase, db } = createContext({ registryCacheService: { getPackageInfo } });
        await insertTestProject(db, "project-1", "yarn");
        await insertTestScanResult(db, {
            id: "scan-1",
            projectId: "project-1",
            name: "react",
            currentVersion: "18.0.0"
        });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ updated: 1 });
        }
        expect(getPackageInfo).toHaveBeenCalledWith("react", "yarn", true);

        const updatedRow = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.id, "scan-1"))
            .get();
        expect(updatedRow?.latestVersion).toBe("18.2.0");
        expect(updatedRow?.upgradeType).toBe("minor");
    });

    it("fails with 500 when the registry cache service throws", async () => {
        const getPackageInfo = vi.fn(async () => {
            throw new Error("registry unreachable");
        });
        const { useCase, db } = createContext({ registryCacheService: { getPackageInfo } });
        await insertTestProject(db, "project-1", "yarn");
        await insertTestScanResult(db, {
            id: "scan-1",
            projectId: "project-1",
            name: "react",
            currentVersion: "18.0.0"
        });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "registry unreachable" });
        }
    });
});
