import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { ListAppSettingsUseCase, UpsertAppSettingUseCase } from "./useCases/settings/index.js";

export async function appSettingsRoutes(
    app: FastifyInstance,
    options: IPluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, listAppSettingsRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ListAppSettingsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        upsertAppSettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpsertAppSettingUseCase);
            const result = await useCase.execute({
                key: request.params.key,
                value: request.body.value
            });

            return send.one({ result });
        }
    );
}
