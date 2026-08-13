import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { dashboardHealthRoute, dashboardScoreDetailRoute } from "#shared/routes/index.js";
import {
    GetDashboardHealthUseCase,
    GetDashboardScoreDetailUseCase
} from "../useCases/dashboard/index.js";

export function registerDashboardHealthRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, dashboardHealthRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardHealthUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, dashboardScoreDetailRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDashboardScoreDetailUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
