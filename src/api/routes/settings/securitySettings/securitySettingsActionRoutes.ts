import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList } from "#shared/routing/index.js";
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

            return sendOne({
                reply,
                request,
                status: 201,
                result,
                route: createSecuritySettingRoute
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

            return sendOne({
                reply,
                request,
                result,
                route: updateSecuritySettingRoute
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

            return sendOne({
                reply,
                request,
                result,
                route: toggleSecuritySettingRoute
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

            return sendList({
                reply,
                request,
                result,
                route: resetSecuritySettingsRoute
            });
        }
    );
}
