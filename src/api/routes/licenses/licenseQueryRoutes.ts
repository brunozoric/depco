import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
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
    registerRoute(app, listLicensesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListLicensesUseCase);
        const result = await useCase.execute(request.query);

        return sendList({
            reply,
            request,
            result,
            route: listLicensesRoute
        });
    });

    registerRoute(app, getLicenseSummaryRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetLicenseSummaryUseCase);
        const result = await useCase.execute(request.query);

        return sendList({
            reply,
            request,
            result,
            route: getLicenseSummaryRoute
        });
    });

    registerRoute(app, getProjectLicensesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectLicensesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            ...request.query
        });

        return sendList({
            reply,
            request,
            result,
            route: getProjectLicensesRoute
        });
    });

    registerRoute(
        app,
        scanProjectLicensesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ScanProjectLicensesUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return sendList({
                reply,
                request,
                result,
                route: scanProjectLicensesRoute
            });
        }
    );
}
