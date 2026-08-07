import { and, eq, lt } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { LicenseScanJobExecutor as Abstraction } from "./abstractions/LicenseScanJobExecutor.js";
import { LicenseCheckerService } from "../abstractions/LicenseCheckerService.js";
import { LicensePolicyService } from "../abstractions/LicensePolicyService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { EventBus } from "../EventBus/index.js";
import { licenses, licenseSnapshots } from "#api/db/schema.js";
import { classifyLicenseRiskTier } from "#shared/licenses/types.js";

declare module "../EventBus/index.js" {
    interface IEventMap {
        "license-scan:completed": [projectId: string];
    }
}

class LicenseScanJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "license-scan" as const;

    public constructor(
        private readonly licenseCheckerService: LicenseCheckerService.Interface,
        private readonly licensePolicyService: LicensePolicyService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly eventBus: EventBus.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const projectId = context.referenceId;
        const packageManager = context.packageManager;

        context.appendLog(`Starting license scan for project ${projectId}`);
        context.setProgress({ percent: 0, label: "Detecting licenses..." });

        const records = await this.licenseCheckerService.scan({
            projectId,
            packageManager
        });
        const scannedAt = Date.now();

        this.databaseClient.db.transaction(tx => {
            for (const record of records) {
                const riskTier = classifyLicenseRiskTier(record.spdxId);
                tx.insert(licenses)
                    .values({
                        id: generateId(),
                        projectId,
                        packageName: record.packageName,
                        licenseName: record.licenseName,
                        spdxId: record.spdxId,
                        source: "registry",
                        riskTier,
                        licenseUrl: record.licenseUrl,
                        scannedAt
                    })
                    .onConflictDoUpdate({
                        target: [licenses.projectId, licenses.packageName],
                        set: {
                            licenseName: record.licenseName,
                            spdxId: record.spdxId,
                            source: "registry",
                            riskTier,
                            licenseUrl: record.licenseUrl,
                            scannedAt
                        }
                    })
                    .run();
            }

            tx.delete(licenses)
                .where(and(eq(licenses.projectId, projectId), lt(licenses.scannedAt, scannedAt)))
                .run();
        });

        context.setProgress({ percent: 50, label: "Evaluating license policy..." });

        const persistedLicenses = await this.databaseClient.db
            .select()
            .from(licenses)
            .where(eq(licenses.projectId, projectId))
            .all();

        const licenseInputs: LicensePolicyService.LicenseInput[] = persistedLicenses.map(
            license => ({
                id: license.id,
                packageName: license.packageName,
                spdxId: license.spdxId,
                licenseName: license.licenseName
            })
        );

        await this.licensePolicyService.evaluate(projectId, licenseInputs);

        context.setProgress({ percent: 80, label: "Recording compliance snapshot..." });

        try {
            const complianceStatus = await this.licensePolicyService.getComplianceStatus(projectId);
            const today = new Date().toISOString().slice(0, 10);
            await this.databaseClient.db
                .insert(licenseSnapshots)
                .values({
                    id: generateId(),
                    projectId,
                    date: today,
                    totalPackages: complianceStatus.total,
                    compliantCount: complianceStatus.allowed,
                    deniedCount: complianceStatus.denied,
                    warnedCount: complianceStatus.warned,
                    scannedAt: Date.now()
                })
                .onConflictDoUpdate({
                    target: [licenseSnapshots.projectId, licenseSnapshots.date],
                    set: {
                        totalPackages: complianceStatus.total,
                        compliantCount: complianceStatus.allowed,
                        deniedCount: complianceStatus.denied,
                        warnedCount: complianceStatus.warned,
                        scannedAt: Date.now()
                    }
                })
                .run();
        } catch {
            // Snapshot recording failure is non-fatal
        }

        context.setProgress({ percent: 100, label: "License scan complete" });
        context.appendLog(`License scan complete: ${persistedLicenses.length} licenses found`);

        this.webSocketBroadcaster.broadcast("license-scan:complete", {
            projectId,
            totalLicenses: persistedLicenses.length,
            violations: 0
        });

        this.eventBus.emit("license-scan:completed", projectId);
    }
}

export const LicenseScanJobExecutor = Abstraction.createImplementation({
    implementation: LicenseScanJobExecutorImpl,
    dependencies: [
        LicenseCheckerService,
        LicensePolicyService,
        DatabaseClient,
        WebSocketBroadcaster,
        EventBus
    ]
});
