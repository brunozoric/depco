import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import {
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";
import { LicenseQueryService } from "#api/services/License/index.js";

export function registerLicenseViolationRoutes(app: FastifyInstance, container: Container): void {
    const licenseQueryService = container.resolve(LicenseQueryService);

    registerRoute(app, listLicenseViolationsRoute, {}, async (request, reply) => {
        const { items, total } = await licenseQueryService.listViolations(request.query);
        sendList({ reply, items, total });
    });

    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, reply) => {
        const summary = await licenseQueryService.getViolationsSummary(request.query);
        reply.send(summary);
    });
}
