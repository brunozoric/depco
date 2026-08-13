import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listLicensePoliciesRoute,
    createLicensePolicyRoute,
    updateLicensePolicyRoute,
    deleteLicensePolicyRoute
} from "#shared/routes/index.js";
import {
    ListLicensePoliciesUseCase,
    CreateLicensePolicyUseCase,
    UpdateLicensePolicyUseCase,
    DeleteLicensePolicyUseCase
} from "./useCases/licenses/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function licensePolicyRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, listLicensePoliciesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListLicensePoliciesUseCase);
        const result = await useCase.execute(request.query);

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        createLicensePolicyRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateLicensePolicyUseCase);
            const result = await useCase.execute(request.body);

            return sendList({
                reply,
                request,
                status: 201,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(
        app,
        updateLicensePolicyRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpdateLicensePolicyUseCase);
            const result = await useCase.execute({ id: request.params.id, ...request.body });

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(
        app,
        deleteLicensePolicyRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteLicensePolicyUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
