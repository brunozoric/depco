import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
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

        return sendList({
            reply,
            request,
            result,
            route: listLicenseViolationsRoute
        });
    });

    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetLicenseViolationsSummaryUseCase);
        const result = await useCase.execute(request.query);

        return sendList({
            reply,
            request,
            result,
            route: getLicenseViolationsSummaryRoute
        });
    });
}
