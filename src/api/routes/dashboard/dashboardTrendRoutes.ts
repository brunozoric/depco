import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import {
    dashboardTrendRoute,
    dashboardVulnerabilityTrendRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute
} from "#shared/routes/index.js";
import {
    GetDashboardTrendUseCase,
    GetDashboardVulnerabilityTrendUseCase,
    GetDashboardStalenessTrendUseCase,
    GetDashboardLicenseTrendUseCase,
    GetDashboardAutoFixTrendUseCase
} from "../useCases/dashboard/index.js";

export function registerDashboardTrendRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, dashboardTrendRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardTrendUseCase);
        const result = await useCase.execute({
            range: request.query.range,
            teamId: request.query.teamId
        });

        return send.list({ result });
    });

    registerRoute(app, dashboardVulnerabilityTrendRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardVulnerabilityTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return send.list({ result });
    });

    registerRoute(app, dashboardStalenessTrendRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardStalenessTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return send.list({ result });
    });

    registerRoute(app, dashboardLicenseTrendRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardLicenseTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return send.list({ result });
    });

    registerRoute(app, dashboardAutoFixTrendRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardAutoFixTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return send.list({ result });
    });
}
