import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { listSecuritySettingsRoute } from "#shared/routes/index.js";
import { ListSecuritySettingsUseCase } from "../../useCases/settings/index.js";

export function registerSecuritySettingsQueryRoutes(
    app: FastifyInstance,
    container: Container
): void {
    registerRoute(app, listSecuritySettingsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListSecuritySettingsUseCase);
        const result = await useCase.execute({});

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });
}
