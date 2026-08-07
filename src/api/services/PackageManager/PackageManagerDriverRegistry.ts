import { PackageManagerDriverRegistry as Abstraction } from "./abstractions/PackageManagerDriverRegistry.js";
import type { PackageManagerDriver } from "./abstractions/PackageManagerDriver.js";
import { YarnDriver } from "./drivers/YarnDriver.js";
import { NpmDriver } from "./drivers/NpmDriver.js";
import { PnpmDriver } from "./drivers/PnpmDriver.js";
import { BunDriver } from "./drivers/BunDriver.js";

class PackageManagerDriverRegistryImpl implements Abstraction.Interface {
    private readonly drivers = new Map<string, PackageManagerDriver.Interface>();

    public constructor() {
        const yarn: PackageManagerDriver.Interface = new YarnDriver();
        const pnpm: PackageManagerDriver.Interface = new PnpmDriver();
        const bun: PackageManagerDriver.Interface = new BunDriver();
        const npm: PackageManagerDriver.Interface = new NpmDriver();

        this.drivers.set(yarn.id, yarn);
        this.drivers.set(pnpm.id, pnpm);
        this.drivers.set(bun.id, bun);
        this.drivers.set(npm.id, npm);
    }

    public getDriver(packageManager: string): PackageManagerDriver.Interface {
        const driver = this.drivers.get(packageManager);
        if (!driver) {
            throw new Error(`No driver for package manager: ${packageManager}`);
        }
        return driver;
    }

    public getAllDrivers(): PackageManagerDriver.Interface[] {
        return Array.from(this.drivers.values());
    }
}

export const PackageManagerDriverRegistry = Abstraction.createImplementation({
    implementation: PackageManagerDriverRegistryImpl,
    dependencies: []
});
