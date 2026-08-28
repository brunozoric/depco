import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listPmSettingsRoute, updatePmConfigRoute } from "#shared/routes/index.js";
import { ListPmSettingsUseCase, UpdatePmConfigUseCase } from "../useCases/settings/index.js";

export function registerPmConfigRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, listPmSettingsRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ListPmSettingsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        updatePmConfigRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdatePmConfigUseCase);
            const result = await useCase.execute({
                pm: request.params.pm,
                installFlags: request.body.installFlags,
                registryUrl: request.body.registryUrl,
                upgradeStrategy: request.body.upgradeStrategy
            });

            return send.one({ result });
        }
    );
}
