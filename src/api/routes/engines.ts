import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq, max } from "drizzle-orm";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import {
    getEngineSummaryRoute,
    listNodeReleasesRoute,
    getProjectEngineChecksRoute,
    getProjectEngineStalenessRoute,
    scanProjectEnginesRoute
} from "#shared/routes/index.js";
import { EngineService, NodeReleaseDataService } from "../services/Engine/index.js";
import { projects, engineChecks } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

/**
 * Mirrors EngineService's private ENGINE_STALENESS_THRESHOLD_MS. Duplicated here
 * (rather than imported) because implementation files are never imported across
 * feature boundaries — only abstractions are. Keep in sync manually if it changes.
 */
const ENGINE_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

type IEngineScanStaleReason = "time" | "release" | "both";

interface IComputeEngineStalenessInput {
    lastScannedAt: number | null;
    maxReleaseDate: number;
    now: number;
    thresholdMs: number;
}

interface IEngineStalenessResult {
    engineScanStale: boolean;
    engineScanStaleReason: IEngineScanStaleReason | null;
}

/** Same staleness rules as EngineService.getSummary(): stale after `thresholdMs` of inactivity, or once a newer Node.js release has shipped since the last scan. */
function computeEngineStaleness(input: IComputeEngineStalenessInput): IEngineStalenessResult {
    const { lastScannedAt, maxReleaseDate, now, thresholdMs } = input;
    if (lastScannedAt === null) {
        return { engineScanStale: false, engineScanStaleReason: null };
    }

    const isTimeStale = lastScannedAt < now - thresholdMs;
    const isReleaseStale = lastScannedAt < maxReleaseDate;

    if (isTimeStale && isReleaseStale) {
        return { engineScanStale: true, engineScanStaleReason: "both" };
    }
    if (isTimeStale) {
        return { engineScanStale: true, engineScanStaleReason: "time" };
    }
    if (isReleaseStale) {
        return { engineScanStale: true, engineScanStaleReason: "release" };
    }
    return { engineScanStale: false, engineScanStaleReason: null };
}

export async function engineRoutes(
    app: FastifyInstance,
    { container }: { container: Container }
): Promise<void> {
    const engineService = container.resolve(EngineService);
    const nodeReleaseDataService = container.resolve(NodeReleaseDataService);
    const databaseClient = container.resolve(DatabaseClient);

    // Registered before "/:projectId" so they aren't shadowed by that param route.
    registerRoute(app, getEngineSummaryRoute, {}, async (_request, reply) => {
        const summary = await engineService.getSummary();
        sendOne({ reply: reply, data: summary });
    });

    registerRoute(app, listNodeReleasesRoute, {}, async (_request, reply) => {
        const items = await nodeReleaseDataService.getSchedule();
        sendList({ reply: reply, items: items, total: items.length });
    });

    registerRoute(app, getProjectEngineChecksRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const items = await engineService.getByProject(projectId);
        sendList({ reply: reply, items: items, total: items.length });
    });

    registerRoute(app, getProjectEngineStalenessRoute, {}, async (request, reply) => {
        const { projectId } = request.params;

        const [row] = await databaseClient.db
            .select({ maxScannedAt: max(engineChecks.scannedAt) })
            .from(engineChecks)
            .where(eq(engineChecks.projectId, projectId))
            .all();
        const lastScannedAt = row?.maxScannedAt ?? null;

        const schedule = await nodeReleaseDataService.getSchedule();
        const maxReleaseDate =
            schedule.length === 0 ? 0 : Math.max(...schedule.map(release => release.releaseDate));

        const staleness = computeEngineStaleness({
            lastScannedAt,
            maxReleaseDate,
            now: Date.now(),
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        sendOne({
            reply: reply,
            data: {
                lastScannedAt,
                engineScanStale: staleness.engineScanStale,
                engineScanStaleReason: staleness.engineScanStaleReason,
                stalenessThresholdMs: ENGINE_STALENESS_THRESHOLD_MS
            }
        });
    });

    registerRoute(app, scanProjectEnginesRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const { warnMaintenance } = request.query;

        const project = await databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();
        if (!project) {
            sendError({ reply: reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const result = await engineService.scan({
            projectId,
            projectPath: project.path,
            ...(warnMaintenance !== undefined && { warnMaintenance })
        });
        sendOne({ reply: reply, data: result });
    });
}
