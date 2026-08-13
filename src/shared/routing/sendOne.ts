import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendOneParams<TResponse> {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<TResponse, SendableError>;
    status?: number;
}

export function sendOne<TResponse>(params: SendOneParams<TResponse>): FastifyReply {
    const { reply, request, result, status } = params;

    if (result.isFail()) {
        const routingOptions = getRoutingOptions(request);
        return sendError({
            reply,
            request,
            error: result.error,
            showStackTrace: routingOptions?.showStackTrace,
            errorLoggerHook: routingOptions?.errorLoggerHook
        });
    }

    return reply.status(status ?? 200).send({ item: result.value });
}
