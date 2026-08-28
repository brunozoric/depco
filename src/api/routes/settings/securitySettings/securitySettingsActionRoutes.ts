import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
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
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateSecuritySettingUseCase);
            const result = await useCase.execute(request.body);

            return send.one({ result, status: 201 });
        }
    );

    registerRoute(
        app,
        updateSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdateSecuritySettingUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                expectedValue: request.body.expectedValue
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        toggleSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ToggleSecuritySettingUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        resetSecuritySettingsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ResetSecuritySettingsUseCase);
            const result = await useCase.execute({ packageManager: request.body.packageManager });

            return send.list({ result });
        }
    );
}
