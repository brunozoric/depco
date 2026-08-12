import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import {
    getEngineSummaryRoute,
    listNodeReleasesRoute,
    getProjectEngineChecksRoute,
    scanProjectEnginesRoute
} from "#shared/routes/index.js";
import { EngineService, NodeReleaseDataService } from "../services/Engine/index.js";
import { projects } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

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
