import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getPackageManagerRoute, updatePackageManagerRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "../services/abstractions/JobWorker.js";
import { PackageManagerService } from "../services/PackageManager/index.js";
import { projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function packageManagerRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);
    const packageManagerService = container.resolve(PackageManagerService);
    const { db } = databaseClient;

    // GET /api/projects/:id/package-manager — current package manager version.
    registerRoute(app, getPackageManagerRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const project = await db.select().from(projects).where(eq(projects.id, id)).get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        const packageManager =
            project.packageManager ?? (await packageManagerService.detect(project.path));
        const version = await packageManagerService.getVersion(project.path, packageManager);
        sendOne(reply, { version });
    });

    // POST /api/projects/:id/package-manager/update — enqueue a package
    // manager version update job.
    registerRoute(
        app,
        updatePackageManagerRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const body = request.body;

            const project = await db.select().from(projects).where(eq(projects.id, id)).get();
            if (!project) {
                sendError(reply, 404, "Project not found");
                return;
            }

            const packageManager =
                project.packageManager ?? (await packageManagerService.detect(project.path));

            let currentVersion: string;
            try {
                currentVersion = await packageManagerService.getVersion(
                    project.path,
                    packageManager
                );
            } catch {
                currentVersion = project.pmVersion ?? "unknown";
            }

            try {
                const jobId = await jobWorker.enqueue({
                    referenceId: id,
                    referenceType: "project",
                    type: "packageManager",
                    packages: { from: currentVersion, to: body.version }
                });

                sendOne(reply, { jobId });
            } catch (error) {
                sendError(reply, 403, (error as Error).message);
            }
        }
    );
}
