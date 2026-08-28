import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import {
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";
import {
    ListLicenseViolationsUseCase,
    GetLicenseViolationsSummaryUseCase
} from "../useCases/licenses/index.js";

export function registerLicenseViolationRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, listLicenseViolationsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListLicenseViolationsUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetLicenseViolationsSummaryUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });
}
