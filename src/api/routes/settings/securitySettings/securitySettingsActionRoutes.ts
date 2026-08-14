import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import type {
    CreateSecuritySettingResponse,
    UpdateSecuritySettingResponse,
    ToggleSecuritySettingResponse,
    ResetSecuritySettingsResponse
} from "#shared/responses/index.js";
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

            return sendOne<CreateSecuritySettingResponse>({
                reply,
                request,
                status: 201,
                result
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

            return sendOne<UpdateSecuritySettingResponse>({
                reply,
                request,
                result
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

            return sendOne<ToggleSecuritySettingResponse>({
                reply,
                request,
                result
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

            return sendList<ResetSecuritySettingsResponse>({
                reply,
                request,
                result
            });
        }
    );
}
