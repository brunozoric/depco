import type { FastifyInstance } from "fastify";
import { registerRoute } from "#shared/routing/index.js";
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

export async function changelogRoutes(app: FastifyInstance): Promise<void> {
    registerRoute(
        app,
        reResolveAllChangelogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(ReResolveAllChangelogsUseCase);
            const result = await useCase.execute({});

            return send.list({ result });
        }
    );

    registerRoute(app, getChangelogStatsRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(GetChangelogStatsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(app, getChangelogsRoute, {}, async (request, _reply, send) => {
        const { packageName } = request.params;
        const { from, to } = request.query;

        const useCase = request.container.resolve(GetChangelogsUseCase);
        const result = await useCase.execute({ packageName, from, to });

        return send.list({ result });
    });

    registerRoute(
        app,
        reResolveChangelogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const { packageName } = request.params;
            const { from, to } = request.body;

            const useCase = request.container.resolve(ReResolveChangelogsUseCase);
            const result = await useCase.execute({ packageName, from, to });

            return send.list({ result });
        }
    );
}
