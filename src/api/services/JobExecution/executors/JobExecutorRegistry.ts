import { JobExecutorRegistry as Abstraction } from "./abstractions/JobExecutorRegistry.js";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { DependencyJobExecutor } from "./abstractions/DependencyJobExecutor.js";
import { TransientJobExecutor } from "./abstractions/TransientJobExecutor.js";
import { PackageManagerJobExecutor } from "./abstractions/PackageManagerJobExecutor.js";
import { ScanJobExecutor } from "./abstractions/ScanJobExecutor.js";
import { CloneJobExecutor } from "./abstractions/CloneJobExecutor.js";
import { InstallJobExecutor } from "./abstractions/InstallJobExecutor.js";
import { ChangelogJobExecutor } from "./abstractions/ChangelogJobExecutor.js";
import { AutoFixPrJobExecutor } from "./abstractions/AutoFixPrJobExecutor.js";
import { TransitiveResolveJobExecutor } from "./abstractions/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor } from "./abstractions/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor } from "./abstractions/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor } from "./abstractions/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor } from "./abstractions/GraphRefreshJobExecutor.js";

class JobExecutorRegistryImpl implements Abstraction.Interface {
    private readonly executors = new Map<string, JobExecutor.Interface>();

    public constructor(
        dependencyJobExecutor: DependencyJobExecutor.Interface,
        transientJobExecutor: TransientJobExecutor.Interface,
        packageManagerJobExecutor: PackageManagerJobExecutor.Interface,
        scanJobExecutor: ScanJobExecutor.Interface,
        cloneJobExecutor: CloneJobExecutor.Interface,
        installJobExecutor: InstallJobExecutor.Interface,
        changelogJobExecutor: ChangelogJobExecutor.Interface,
        autoFixPrJobExecutor: AutoFixPrJobExecutor.Interface,
        transitiveResolveJobExecutor: TransitiveResolveJobExecutor.Interface,
        packageScanJobExecutor: PackageScanJobExecutor.Interface,
        vulnerabilityScanJobExecutor: VulnerabilityScanJobExecutor.Interface,
        licenseScanJobExecutor: LicenseScanJobExecutor.Interface,
        graphRefreshJobExecutor: GraphRefreshJobExecutor.Interface
    ) {
        const all: JobExecutor.Interface[] = [
            dependencyJobExecutor,
            transientJobExecutor,
            packageManagerJobExecutor,
            scanJobExecutor,
            cloneJobExecutor,
            installJobExecutor,
            changelogJobExecutor,
            autoFixPrJobExecutor,
            transitiveResolveJobExecutor,
            packageScanJobExecutor,
            vulnerabilityScanJobExecutor,
            licenseScanJobExecutor,
            graphRefreshJobExecutor
        ];

        for (const executor of all) {
            this.executors.set(executor.type, executor);
        }
    }

    public getExecutor(type: string): JobExecutor.Interface {
        const executor = this.executors.get(type);
        if (!executor) {
            throw new Error(`No executor for job type: ${type}`);
        }
        return executor;
    }
}

export const JobExecutorRegistry = Abstraction.createImplementation({
    implementation: JobExecutorRegistryImpl,
    dependencies: [
        DependencyJobExecutor,
        TransientJobExecutor,
        PackageManagerJobExecutor,
        ScanJobExecutor,
        CloneJobExecutor,
        InstallJobExecutor,
        ChangelogJobExecutor,
        AutoFixPrJobExecutor,
        TransitiveResolveJobExecutor,
        PackageScanJobExecutor,
        VulnerabilityScanJobExecutor,
        LicenseScanJobExecutor,
        GraphRefreshJobExecutor
    ]
});
