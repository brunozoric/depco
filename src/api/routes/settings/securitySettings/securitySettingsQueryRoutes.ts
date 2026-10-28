import type { FastifyInstance } from "fastify";
import { registerRoute } from "#shared/routing/index.js";
import { listSecuritySettingsRoute } from "#shared/routes/index.js";
import { ListSecuritySettingsUseCase } from "../../useCases/settings/index.js";

export function registerSecuritySettingsQueryRoutes(app: FastifyInstance): void {
    registerRoute(app, listSecuritySettingsRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(ListSecuritySettingsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });
}
