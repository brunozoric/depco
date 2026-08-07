import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getAutoFixSettingsRoute, updateAutoFixSettingsRoute } from "#shared/routes/index.js";
import { AutoFixSettingsService } from "#api/services/abstractions/AutoFixSettingsService.js";

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
    const autoFixSettingsService = container.resolve(AutoFixSettingsService);

    registerRoute(app, getAutoFixSettingsRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const settings = await autoFixSettingsService.getSettingsOrDefaults(projectId);
        reply.send(settings);
    });

    registerRoute(
        app,
        updateAutoFixSettingsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;
            const input = buildUpdateSettingsInput(request.body);
            const settings = await autoFixSettingsService.updateSettings(projectId, input);
            reply.send(settings);
        }
    );
}
