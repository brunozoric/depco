import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getTransitiveResolveStatusRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    getProjectTeamsRoute,
    setProjectTeamsRoute
} from "#shared/routes/index.js";
import {
    ScanProjectUseCase,
    GetProjectDependenciesUseCase,
    GetTransitiveResolveStatusUseCase,
    GetProjectSecurityUseCase,
    CheckProjectSecurityUseCase,
    GetProjectTeamsUseCase,
    SetProjectTeamsUseCase
} from "../useCases/projects/index.js";

export function registerProjectDetailRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(
        app,
        scanProjectAsyncRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ScanProjectUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                force: request.query.force
            });

            return send.one({ result });
        }
    );

    registerRoute(app, getProjectDependenciesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectDependenciesUseCase);
        const result = await useCase.execute({
            id: request.params.id,
            dependencyKind: request.query.dependencyKind,
            registryResolved: request.query.registryResolved,
            search: request.query.search,
            page: request.query.page,
            pageSize: request.query.pageSize
        });

        return send.list({ result });
    });

    registerRoute(app, getTransitiveResolveStatusRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetTransitiveResolveStatusUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.list({ result });
    });

    registerRoute(app, getProjectSecurityRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectSecurityUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.one({ result });
    });

    registerRoute(
        app,
        checkProjectSecurityRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CheckProjectSecurityUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return send.one({ result });
        }
    );

    registerRoute(app, getProjectTeamsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectTeamsUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.list({ result });
    });

    registerRoute(
        app,
        setProjectTeamsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(SetProjectTeamsUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                teamIds: request.body.teamIds
            });

            return send.none({ result });
        }
    );
}
