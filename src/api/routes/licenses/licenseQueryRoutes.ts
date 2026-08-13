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

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getLicenseSummaryRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetLicenseSummaryUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getProjectLicensesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectLicensesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            ...request.query
        });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        scanProjectLicensesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ScanProjectLicensesUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
