import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { ListAppSettingsUseCase, UpsertAppSettingUseCase } from "./useCases/settings/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function appSettingsRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, listAppSettingsRoute, {}, async (_request, reply) => {
        const useCase = container.resolve(ListAppSettingsUseCase);
        const result = await useCase.execute({});

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        upsertAppSettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpsertAppSettingUseCase);
            const result = await useCase.execute({
                key: request.params.key,
                value: request.body.value
            });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
