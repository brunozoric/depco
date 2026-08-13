import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createSecuritySettingRoute,
    updateSecuritySettingRoute,
    toggleSecuritySettingRoute,
    resetSecuritySettingsRoute
} from "#shared/routes/index.js";
import {
    CreateSecuritySettingUseCase,
    UpdateSecuritySettingUseCase,
    ToggleSecuritySettingUseCase,
    ResetSecuritySettingsUseCase
} from "../../useCases/settings/index.js";

export function registerSecuritySettingsActionRoutes(
    app: FastifyInstance,
    container: Container
): void {
    registerRoute(
        app,
        createSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateSecuritySettingUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => sendOne({ reply, data, status: 201 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        updateSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpdateSecuritySettingUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                expectedValue: request.body.expectedValue
            });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        toggleSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ToggleSecuritySettingUseCase);
            const result = await useCase.execute({ id: request.params.id });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        resetSecuritySettingsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ResetSecuritySettingsUseCase);
            const result = await useCase.execute({ packageManager: request.body.packageManager });

            result.match({
                ok: data => sendList({ reply, items: data.items, total: data.total }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
