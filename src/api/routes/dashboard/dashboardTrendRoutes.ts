import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
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
    registerRoute(app, dashboardTrendRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardTrendUseCase);
        const result = await useCase.execute({
            range: request.query.range,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, dashboardVulnerabilityTrendRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardVulnerabilityTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, dashboardStalenessTrendRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardStalenessTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, dashboardLicenseTrendRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardLicenseTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, dashboardAutoFixTrendRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardAutoFixTrendUseCase);
        const result = await useCase.execute({
            days: request.query.days,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });
}
