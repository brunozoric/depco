import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import {
    createUpgradeSessionRoute,
    getUpgradeSessionRoute,
    executeUpgradeStepRoute,
    skipUpgradeStepRoute,
    abortUpgradeSessionRoute
} from "#shared/routes/index.js";
import { UpgradeSessionService } from "#api/services/abstractions/UpgradeSessionService.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

function mapErrorStatus(message: string): number {
    if (message.includes("not found")) {
        return 404;
    }
    if (message.includes("not active")) {
        return 409;
    }
    if (
        message.includes("not the current step") ||
        message.includes("required") ||
        message.includes("non-empty array") ||
        message.includes("is required") ||
        message.includes("No packages")
    ) {
        return 400;
    }
    return 500;
}

export async function upgradeSessionRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const upgradeSessionService = container.resolve(UpgradeSessionService);

    registerRoute(app, createUpgradeSessionRoute, {}, async (request, reply) => {
        const { id } = request.params;

        try {
            const session = await upgradeSessionService.createSession(id);
            sendOne(reply, session);
        } catch (error) {
            const message = (error as Error).message;
            sendError(reply, mapErrorStatus(message), message);
        }
    });

    registerRoute(app, getUpgradeSessionRoute, {}, async (request, reply) => {
        const { id, sessionId } = request.params;

        try {
            const session = await upgradeSessionService.getSession(sessionId, id);
            if (!session) {
                sendError(reply, 404, "Session not found");
                return;
            }
            sendOne(reply, session);
        } catch (error) {
            const message = (error as Error).message;
            sendError(reply, mapErrorStatus(message), message);
        }
    });

    registerRoute(app, executeUpgradeStepRoute, {}, async (request, reply) => {
        const { id, sessionId, stepType } = request.params;

        try {
            const session = await upgradeSessionService.executeStep(
                sessionId,
                id,
                stepType,
                request.body
            );
            sendOne(reply, session);
        } catch (error) {
            const message = (error as Error).message;
            sendError(reply, mapErrorStatus(message), message);
        }
    });

    registerRoute(app, skipUpgradeStepRoute, {}, async (request, reply) => {
        const { id, sessionId, stepType } = request.params;

        try {
            const session = await upgradeSessionService.skipStep(sessionId, id, stepType);
            sendOne(reply, session);
        } catch (error) {
            const message = (error as Error).message;
            sendError(reply, mapErrorStatus(message), message);
        }
    });

    registerRoute(app, abortUpgradeSessionRoute, {}, async (request, reply) => {
        const { id, sessionId } = request.params;

        try {
            const session = await upgradeSessionService.abortSession(sessionId, id);
            sendOne(reply, session);
        } catch (error) {
            const message = (error as Error).message;
            sendError(reply, mapErrorStatus(message), message);
        }
    });
}
