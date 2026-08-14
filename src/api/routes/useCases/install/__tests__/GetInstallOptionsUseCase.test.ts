import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageManagerDriverRegistry } from "#api/services/PackageManager/index.js";
import type { PackageManagerDriver } from "#api/services/PackageManager/abstractions/PackageManagerDriver.js";
import { InstallUseCasesFeature } from "../feature.js";
import { GetInstallOptionsUseCase } from "../abstractions/GetInstallOptionsUseCase.js";

interface ICreateContextOptions {
    driverRegistry?: Partial<PackageManagerDriverRegistry.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetInstallOptionsUseCase.Interface;
}

function createDriverStub(
    overrides?: Partial<PackageManagerDriver.Interface>
): PackageManagerDriver.Interface {
    return {
        id: "yarn",
        lockfileName: "yarn.lock",
        versionCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        updateVersionCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        installedVersionsCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        parseInstalledVersions: vi.fn(() => new Map()),
        workspacesCommand: vi.fn(() => null),
        parseWorkspaces: vi.fn(() => []),
        upgradePackageCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        refreshTransientCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        registryInfoCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        parseRegistryInfo: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        installFlags: vi.fn(() => []),
        installCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        auditCommand: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createDriverRegistryStub(
    overrides?: Partial<PackageManagerDriverRegistry.Interface>
): PackageManagerDriverRegistry.Interface {
    return {
        getDriver: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        getAllDrivers: vi.fn(() => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    InstallUseCasesFeature.register(container);
    container.registerInstance(
        PackageManagerDriverRegistry,
        createDriverRegistryStub(options.driverRegistry)
    );

    return { container, useCase: container.resolve(GetInstallOptionsUseCase) };
}

describe("GetInstallOptionsUseCase", () => {
    it("returns the install flags for the requested package manager", async () => {
        const flags: PackageManagerDriver.InstallFlagDefinition[] = [
            {
                flag: "--immutable",
                label: "Immutable",
                description: "Fail on lockfile changes",
                defaultEnabled: true
            },
            {
                flag: "--frozen-lockfile",
                label: "Frozen lockfile",
                description: "Do not update lockfile",
                defaultEnabled: false
            }
        ];
        const driver = createDriverStub({ installFlags: vi.fn(() => flags) });
        const getDriver = vi.fn(() => driver);
        const { useCase } = createContext({ driverRegistry: { getDriver } });

        const result = await useCase.execute({ packageManager: "yarn" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: flags, total: 2 });
        expect(getDriver).toHaveBeenCalledWith("yarn");
    });

    it("fails with 400 when the package manager is unknown", async () => {
        const getDriver = vi.fn(() => {
            throw new Error("Unknown package manager: cargo");
        });
        const { useCase } = createContext({ driverRegistry: { getDriver } });

        const result = await useCase.execute({ packageManager: "cargo" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNKNOWN_PACKAGE_MANAGER",
            statusCode: 400,
            message: "Unknown package manager: cargo"
        });
    });
});
