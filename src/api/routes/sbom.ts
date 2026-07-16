import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendError, sendBlob } from "#shared/routing/index.js";
import { exportAllSbomRoute, exportProjectSbomRoute } from "#shared/routes/index.js";
import { SbomService } from "../services/abstractions/SbomService.js";
import { SbomFormatterRegistry } from "../services/abstractions/SbomFormatterRegistry.js";
import { projects } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

export async function sbomRoutes(
    app: FastifyInstance,
    { container }: { container: Container }
): Promise<void> {
    const sbomService = container.resolve(SbomService);
    const databaseClient = container.resolve(DatabaseClient);

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, exportAllSbomRoute, {}, async (request, reply) => {
        const { format } = request.query;
        const formatterRegistry = container.resolve(SbomFormatterRegistry);
        const formatter = formatterRegistry.get(format);
        const data = await sbomService.collectForAllProjects();
        const result = formatter.format(data);
        sendBlob(reply, result.content, result.filename, result.mediaType);
    });

    registerRoute(app, exportProjectSbomRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const { format } = request.query;

        const project = await databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();

        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        const formatterRegistry = container.resolve(SbomFormatterRegistry);
        const formatter = formatterRegistry.get(format);
        const data = await sbomService.collectForProject(projectId);
        const result = formatter.format(data);
        sendBlob(reply, result.content, result.filename, result.mediaType);
    });
}
