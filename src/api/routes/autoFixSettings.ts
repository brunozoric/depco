import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getAutoFixSettingsRoute, updateAutoFixSettingsRoute } from "#shared/routes/index.js";
import type { AutoFixSettingsService } from "#api/services/AutoFix/index.js";
import {
    GetAutoFixSettingsUseCase,
    UpdateAutoFixSettingsUseCase
} from "./useCases/autoFix/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IUpdateAutoFixSettingsBody {
    enabled?: boolean | undefined;
    upgradeTypes?: string[] | undefined;
    groupingStrategy?: string | undefined;
    branchPrefix?: string | undefined;
}

function buildUpdateSettingsInput(
    body: IUpdateAutoFixSettingsBody
): AutoFixSettingsService.UpdateInput {
    const input: AutoFixSettingsService.UpdateInput = {};
    if (body.enabled !== undefined) {
        input.enabled = body.enabled;
    }
    if (body.upgradeTypes !== undefined) {
        input.upgradeTypes = body.upgradeTypes;
    }
    if (body.groupingStrategy !== undefined) {
        input.groupingStrategy = body.groupingStrategy;
    }
    if (body.branchPrefix !== undefined) {
        input.branchPrefix = body.branchPrefix;
    }
    return input;
}

export async function autoFixSettingsRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, getAutoFixSettingsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetAutoFixSettingsUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return send.list({ result });
    });

    registerRoute(
        app,
        updateAutoFixSettingsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdateAutoFixSettingsUseCase);
            const result = await useCase.execute({
                projectId: request.params.projectId,
                input: buildUpdateSettingsInput(request.body)
            });

            return send.list({ result });
        }
    );
}
