import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { listSecuritySettingsRoute } from "#shared/routes/index.js";
import { ListSecuritySettingsUseCase } from "../../useCases/settings/index.js";

export function registerSecuritySettingsQueryRoutes(
    app: FastifyInstance,
    container: Container
): void {
    registerRoute(app, listSecuritySettingsRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ListSecuritySettingsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });
}
