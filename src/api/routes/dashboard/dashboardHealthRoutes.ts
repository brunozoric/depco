import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { dashboardHealthRoute, dashboardScoreDetailRoute } from "#shared/routes/index.js";
import {
    GetDashboardHealthUseCase,
    GetDashboardScoreDetailUseCase
} from "../useCases/dashboard/index.js";

export function registerDashboardHealthRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, dashboardHealthRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardHealthUseCase);
        const result = await useCase.execute({ teamId: request.query.teamId });

        return send.list({ result });
    });

    registerRoute(app, dashboardScoreDetailRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDashboardScoreDetailUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return send.list({ result });
    });
}
