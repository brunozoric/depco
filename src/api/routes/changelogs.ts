import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    getChangelogsRoute,
    reResolveChangelogsRoute,
    reResolveAllChangelogsRoute,
    getChangelogStatsRoute
} from "#shared/routes/index.js";
import {
    GetChangelogsUseCase,
    ReResolveChangelogsUseCase,
    ReResolveAllChangelogsUseCase,
    GetChangelogStatsUseCase
} from "./useCases/changelogs/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function changelogRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(
        app,
        reResolveAllChangelogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ReResolveAllChangelogsUseCase);
            const result = await useCase.execute({});

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(app, getChangelogStatsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetChangelogStatsUseCase);
        const result = await useCase.execute({});

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, getChangelogsRoute, {}, async (request, reply) => {
        const { packageName } = request.params;
        const { from, to } = request.query;

        const useCase = container.resolve(GetChangelogsUseCase);
        const result = await useCase.execute({ packageName, from, to });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        reResolveChangelogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageName } = request.params;
            const { from, to } = request.body;

            const useCase = container.resolve(ReResolveChangelogsUseCase);
            const result = await useCase.execute({ packageName, from, to });

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
