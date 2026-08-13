import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
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

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, dashboardStalenessRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardStalenessUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, dashboardSecurityRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardSecurityUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, dashboardDependencyChangesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardDependencyChangesUseCase);
        const result = await useCase.execute({
            projectId: request.query.projectId,
            limit: request.query.limit,
            teamId: request.query.teamId
        });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
