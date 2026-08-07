import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { DependencyChangeService as Abstraction } from "./abstractions/DependencyChangeService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults, dependencyChanges } from "#api/db/schema.js";

interface IExistingPackage {
    name: string;
    currentVersion: string;
}

interface IChangeRecord {
    packageName: string;
    changeType: string;
    previousVersion: string | null;
    newVersion: string | null;
}

class DependencyChangeServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async detectAndPersist(
        projectId: string,
        newScanResults: Abstraction.ScanResultInput[]
    ): Promise<number> {
        const { db } = this.databaseClient;

        const existingRows = await db
            .select({ name: scanResults.name, currentVersion: scanResults.currentVersion })
            .from(scanResults)
            .where(eq(scanResults.projectId, projectId))
            .all();

        const existingMap = new Map<string, IExistingPackage>();
        for (const row of existingRows) {
            existingMap.set(row.name, row);
        }

        const newMap = new Map<string, Abstraction.ScanResultInput>();
        for (const result of newScanResults) {
            newMap.set(result.name, result);
        }

        const changes: IChangeRecord[] = [];
        const now = Date.now();

        for (const [name, newResult] of newMap) {
            const existing = existingMap.get(name);
            if (!existing) {
                changes.push({
                    packageName: name,
                    changeType: "added",
                    previousVersion: null,
                    newVersion: newResult.currentVersion
                });
            } else if (existing.currentVersion !== newResult.currentVersion) {
                changes.push({
                    packageName: name,
                    changeType: "version-changed",
                    previousVersion: existing.currentVersion,
                    newVersion: newResult.currentVersion
                });
            }
        }

        for (const [name, existing] of existingMap) {
            if (!newMap.has(name)) {
                changes.push({
                    packageName: name,
                    changeType: "removed",
                    previousVersion: existing.currentVersion,
                    newVersion: null
                });
            }
        }

        if (changes.length > 0) {
            const rows = changes.map(change => ({
                id: generateId(),
                projectId,
                packageName: change.packageName,
                changeType: change.changeType,
                previousVersion: change.previousVersion,
                newVersion: change.newVersion,
                detectedAt: now
            }));

            const BATCH_SIZE = 100;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                db.insert(dependencyChanges)
                    .values(rows.slice(i, i + BATCH_SIZE))
                    .run();
            }
        }

        return changes.length;
    }
}

export const DependencyChangeService = Abstraction.createImplementation({
    implementation: DependencyChangeServiceImpl,
    dependencies: [DatabaseClient]
});
