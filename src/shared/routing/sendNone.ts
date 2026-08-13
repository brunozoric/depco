import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendNoneParams {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<unknown, SendableError>;
    status?: number;
}

export function sendNone(params: SendNoneParams): FastifyReply {
    const { reply, request, result, status } = params;

    if (result.isFail()) {
        const routingOptions = getRoutingOptions(request);
        return sendError({
            reply,
            request,
            error: result.error,
            ...(routingOptions?.showStackTrace !== undefined && {
                showStackTrace: routingOptions.showStackTrace
            }),
            ...(routingOptions?.errorLoggerHook !== undefined && {
                errorLoggerHook: routingOptions.errorLoggerHook
            })
        });
    }

    const statusCode = status ?? 200;

    if (statusCode === 204) {
        return reply.status(204).send();
    }

    return reply.status(statusCode).send({ success: true });
}
