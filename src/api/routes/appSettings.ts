import type { FastifyInstance } from "fastify";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { ListAppSettingsUseCase, UpsertAppSettingUseCase } from "./useCases/settings/index.js";

export async function appSettingsRoutes(app: FastifyInstance): Promise<void> {
    registerRoute(app, listAppSettingsRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(ListAppSettingsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        upsertAppSettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(UpsertAppSettingUseCase);
            const result = await useCase.execute({
                key: request.params.key,
                value: request.body.value
            });

            return send.one({ result });
        }
    );
}
