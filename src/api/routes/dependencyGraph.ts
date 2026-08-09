import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    getDependencyGraphRoute,
    refreshDependencyGraphRoute,
    getDependencyGraphStatsRoute,
    searchDependencyPackagesRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function dependencyGraphRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const dependencyGraphService = container.resolve(DependencyGraphService);
    const { db } = databaseClient;

    registerRoute(app, getDependencyGraphRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const { package: packageName } = request.query;

        if (packageName) {
            const paths = await dependencyGraphService.findPaths({ projectId, packageName });
            reply.send({ paths });
            return;
        }

        const graph = await dependencyGraphService.getGraph(projectId);
        reply.send(graph);
    });

    registerRoute(app, searchDependencyPackagesRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const { query, limit } = request.query;
        const packages = await dependencyGraphService.searchPackages({
            projectId,
            query,
            ...(limit === undefined ? {} : { limit })
        });
        reply.send({ packages });
    });

    registerRoute(
        app,
        refreshDependencyGraphRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, projectId))
                .get();
            if (!project) {
                sendError(reply, 404, "Project not found");
                return;
            }
            if (!project.packageManager) {
                sendError(reply, 400, "Project has no detected package manager");
                return;
            }

            const edgeCount = await dependencyGraphService.refreshGraph(
                projectId,
                project.path,
                project.packageManager
            );
            reply.send({ edgeCount });
        }
    );

    registerRoute(app, getDependencyGraphStatsRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const graph = await dependencyGraphService.getGraph(projectId);
        reply.send({
            totalPackages: graph.totalPackages,
            maxDepth: graph.maxDepth,
            rootCount: graph.rootPackages.length,
            edgeCount: graph.edgeCount
        });
    });
}
