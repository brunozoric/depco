import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import {
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";
import {
    ListLicenseViolationsUseCase,
    GetLicenseViolationsSummaryUseCase
} from "../useCases/licenses/index.js";

export function registerLicenseViolationRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, listLicenseViolationsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListLicenseViolationsUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetLicenseViolationsSummaryUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
