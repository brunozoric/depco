import { eq, max } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { NodeReleaseDataService } from "#api/services/Engine/index.js";
import { engineChecks } from "#api/db/schema.js";
import { computeEngineStaleness, ENGINE_STALENESS_THRESHOLD_MS } from "./engineStaleness.js";
import { GetProjectEngineStalenessUseCase as Abstraction } from "./abstractions/GetProjectEngineStalenessUseCase.js";

class GetProjectEngineStalenessUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly nodeReleaseDataService: NodeReleaseDataService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        let lastScannedAt: number | null;
        try {
            const { db } = this.databaseClient;
            const [row] = await db
                .select({ maxScannedAt: max(engineChecks.scannedAt) })
                .from(engineChecks)
                .where(eq(engineChecks.projectId, params.projectId))
                .all();
            lastScannedAt = row?.maxScannedAt ?? null;
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        let maxReleaseDate: number;
        try {
            const schedule = await this.nodeReleaseDataService.getSchedule();
            maxReleaseDate =
                schedule.length === 0
                    ? 0
                    : Math.max(...schedule.map(release => release.releaseDate));
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        const staleness = computeEngineStaleness({
            lastScannedAt,
            maxReleaseDate,
            now: Date.now(),
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        return Result.ok({
            lastScannedAt,
            engineScanStale: staleness.engineScanStale,
            engineScanStaleReason: staleness.engineScanStaleReason,
            stalenessThresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });
    }
}

export const GetProjectEngineStalenessUseCase = Abstraction.createImplementation({
    implementation: GetProjectEngineStalenessUseCaseImpl,
    dependencies: [DatabaseClient, NodeReleaseDataService]
});
