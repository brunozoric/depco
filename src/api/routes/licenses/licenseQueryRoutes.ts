import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listLicensesRoute,
    getLicenseSummaryRoute,
    getProjectLicensesRoute,
    scanProjectLicensesRoute
} from "#shared/routes/index.js";
import {
    ListLicensesUseCase,
    GetLicenseSummaryUseCase,
    GetProjectLicensesUseCase,
    ScanProjectLicensesUseCase
} from "../useCases/licenses/index.js";

export function registerLicenseQueryRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, listLicensesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListLicensesUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(app, getLicenseSummaryRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetLicenseSummaryUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(app, getProjectLicensesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectLicensesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            ...request.query
        });

        return send.list({ result });
    });

    registerRoute(
        app,
        scanProjectLicensesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ScanProjectLicensesUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return send.list({ result });
        }
    );
}
