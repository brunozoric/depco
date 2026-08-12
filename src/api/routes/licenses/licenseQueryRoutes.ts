import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listLicensesRoute,
    getLicenseSummaryRoute,
    getProjectLicensesRoute,
    scanProjectLicensesRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";

export function registerLicenseQueryRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);
    const licenseQueryService = container.resolve(LicenseQueryService);
    const { db } = databaseClient;

    registerRoute(app, listLicensesRoute, {}, async (request, reply) => {
        const { items, total } = await licenseQueryService.listLicenses(request.query);
        sendList({ reply: reply, items: items, total: total });
    });

    registerRoute(app, getLicenseSummaryRoute, {}, async (request, reply) => {
        const summary = await licenseQueryService.getLicenseSummary(request.query);
        reply.send(summary);
    });

    registerRoute(app, getProjectLicensesRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const { items, total } = await licenseQueryService.listProjectLicenses({
            projectId,
            ...request.query
        });
        sendList({ reply: reply, items: items, total: total });
    });

    registerRoute(
        app,
        scanProjectLicensesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, projectId))
                .get();
            if (!project) {
                sendError({ reply: reply, statusCode: 404, message: "Project not found" });
                return;
            }

            const jobId = await jobWorker.enqueue({
                referenceId: projectId,
                referenceType: "project",
                type: "scan"
            });
            reply.send({ jobId });
        }
    );
}
