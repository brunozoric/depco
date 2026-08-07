import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { installProjectRoute, getInstallOptionsRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerDriverRegistry } from "#api/services/packageManagers/abstractions/PackageManagerDriverRegistry.js";
import type { PackageManagerDriver } from "#api/services/packageManagers/abstractions/PackageManagerDriver.js";
import { JobWorker } from "#api/services/abstractions/JobWorker.js";
import { projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function installRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const driverRegistry = container.resolve(PackageManagerDriverRegistry);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    registerRoute(
        app,
        installProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { flags } = request.body;

            const project = await db.select().from(projects).where(eq(projects.id, id)).get();
            if (!project) {
                sendError(reply, 404, "Project not found");
                return;
            }

            if (!project.packageManager) {
                sendError(reply, 400, "No package manager detected for this project");
                return;
            }

            const jobId = await jobWorker.enqueue({
                referenceId: id,
                referenceType: "project",
                type: "install",
                packages: JSON.stringify({ flags })
            });

            sendOne(reply, { jobId });
        }
    );

    // GET /api/install-options/:packageManager — available install flags for a driver.
    registerRoute(app, getInstallOptionsRoute, {}, async (request, reply) => {
        const { packageManager } = request.params;

        let driver: PackageManagerDriver.Interface;
        try {
            driver = driverRegistry.getDriver(packageManager);
        } catch (error) {
            sendError(reply, 400, (error as Error).message);
            return;
        }

        const items = driver.installFlags();
        sendList(reply, items, items.length);
    });
}
