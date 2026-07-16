import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "../abstractions/PackageManagerDriverRegistry.js";
import { PackageManagerDriverRegistry as RegistryRegistration } from "../PackageManagerDriverRegistry.js";

describe("PackageManagerDriverRegistry", () => {
    function createRegistry(): PackageManagerDriverRegistry.Interface {
        const container = createContainer();
        container.register(RegistryRegistration).inSingletonScope();
        return container.resolve(PackageManagerDriverRegistry);
    }

    it("returns yarn driver for 'yarn'", () => {
        const registry = createRegistry();
        const driver = registry.getDriver("yarn");
        expect(driver.id).toBe("yarn");
        expect(driver.lockfileName).toBe("yarn.lock");
    });

    it("returns npm driver for 'npm'", () => {
        const registry = createRegistry();
        const driver = registry.getDriver("npm");
        expect(driver.id).toBe("npm");
    });

    it("returns pnpm driver for 'pnpm'", () => {
        const registry = createRegistry();
        const driver = registry.getDriver("pnpm");
        expect(driver.id).toBe("pnpm");
    });

    it("returns bun driver for 'bun'", () => {
        const registry = createRegistry();
        const driver = registry.getDriver("bun");
        expect(driver.id).toBe("bun");
        expect(driver.lockfileName).toBe("bun.lock");
    });

    it("throws for unknown package manager", () => {
        const registry = createRegistry();
        expect(() => registry.getDriver("unknown-pm")).toThrow(
            "No driver for package manager: unknown-pm"
        );
    });

    it("getAllDrivers returns drivers in priority order: yarn, pnpm, bun, npm", () => {
        const registry = createRegistry();
        const drivers = registry.getAllDrivers();
        expect(drivers).toHaveLength(4);
        expect(drivers[0]!.id).toBe("yarn");
        expect(drivers[1]!.id).toBe("pnpm");
        expect(drivers[2]!.id).toBe("bun");
        expect(drivers[3]!.id).toBe("npm");
    });
});
