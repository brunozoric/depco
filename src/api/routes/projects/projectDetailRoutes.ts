import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
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
        async (request, reply) => {
            const useCase = container.resolve(ScanProjectUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                force: request.query.force
            });

            return sendOne({
                reply,
                request,
                result
            });
        }
    );

    registerRoute(app, getProjectDependenciesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectDependenciesUseCase);
        const result = await useCase.execute({
            id: request.params.id,
            dependencyKind: request.query.dependencyKind,
            registryResolved: request.query.registryResolved,
            search: request.query.search,
            page: request.query.page,
            pageSize: request.query.pageSize
        });

        return sendList({
            reply,
            request,
            result
        });
    });

    registerRoute(app, getTransitiveResolveStatusRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetTransitiveResolveStatusUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendList({
            reply,
            request,
            result
        });
    });

    registerRoute(app, getProjectSecurityRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectSecurityUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendOne({
            reply,
            request,
            result
        });
    });

    registerRoute(
        app,
        checkProjectSecurityRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CheckProjectSecurityUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return sendOne({
                reply,
                request,
                result
            });
        }
    );

    registerRoute(app, getProjectTeamsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectTeamsUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendList({
            reply,
            request,
            result
        });
    });

    registerRoute(
        app,
        setProjectTeamsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(SetProjectTeamsUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                teamIds: request.body.teamIds
            });

            return sendNone({
                reply,
                request,
                result
            });
        }
    );
}
