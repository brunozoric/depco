import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendError, sendBlob } from "#shared/routing/index.js";
import { exportAllSbomRoute, exportProjectSbomRoute } from "#shared/routes/index.js";
import { SbomService } from "../services/Sbom/index.js";
import { SbomFormatterRegistry } from "../services/Sbom/index.js";
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
        sendBlob({
            reply: reply,
            content: result.content,
            filename: result.filename,
            mediaType: result.mediaType
        });
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
            sendError({ reply: reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const formatterRegistry = container.resolve(SbomFormatterRegistry);
        const formatter = formatterRegistry.get(format);
        const data = await sbomService.collectForProject(projectId);
        const result = formatter.format(data);
        sendBlob({
            reply: reply,
            content: result.content,
            filename: result.filename,
            mediaType: result.mediaType
        });
    });
}
