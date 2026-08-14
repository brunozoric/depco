import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import {
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    dashboardDependencyChangesRoute
} from "#shared/routes/index.js";
import {
    GetDashboardActivityUseCase,
    GetDashboardStalenessUseCase,
    GetDashboardSecurityUseCase,
    GetDashboardDependencyChangesUseCase
} from "../useCases/dashboard/index.js";

export function registerDashboardStatusRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, dashboardActivityRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardActivityUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        return sendList({
            reply,
            request,
            result,
            route: dashboardActivityRoute
        });
    });

    registerRoute(app, dashboardStalenessRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardStalenessUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        return sendList({
            reply,
            request,
            result,
            route: dashboardStalenessRoute
        });
    });

    registerRoute(app, dashboardSecurityRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardSecurityUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        return sendList({
            reply,
            request,
            result,
            route: dashboardSecurityRoute
        });
    });

    registerRoute(app, dashboardDependencyChangesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardDependencyChangesUseCase);
        const result = await useCase.execute({
            projectId: request.query.projectId,
            limit: request.query.limit,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result,
            route: dashboardDependencyChangesRoute
        });
    });
}
