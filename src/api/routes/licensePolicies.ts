import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import type {
    ListLicensePoliciesResponse,
    PolicyRuleResponse,
    DeleteLicensePolicyResponse
} from "#shared/responses/licenses.js";
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

        return sendList<ListLicensePoliciesResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(
        app,
        createLicensePolicyRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateLicensePolicyUseCase);
            const result = await useCase.execute(request.body);

            return sendList<PolicyRuleResponse>({
                reply,
                request,
                status: 201,
                result
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

            return sendList<PolicyRuleResponse>({
                reply,
                request,
                result
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

            return sendList<DeleteLicensePolicyResponse>({
                reply,
                request,
                result
            });
        }
    );
}
