import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
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

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        createLicensePolicyRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateLicensePolicyUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => {
                    reply.status(201).send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
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

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
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

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
