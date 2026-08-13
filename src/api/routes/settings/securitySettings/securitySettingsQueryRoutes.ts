import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { listSecuritySettingsRoute } from "#shared/routes/index.js";
import { ListSecuritySettingsUseCase } from "../../useCases/settings/index.js";

export function registerSecuritySettingsQueryRoutes(
    app: FastifyInstance,
    container: Container
): void {
    registerRoute(app, listSecuritySettingsRoute, {}, async (_request, reply) => {
        const useCase = container.resolve(ListSecuritySettingsUseCase);
        const result = await useCase.execute({});

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
