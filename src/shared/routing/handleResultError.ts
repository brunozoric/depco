import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

export function handleResultError(input: {
    reply: FastifyReply;
    request: FastifyRequest;
    error: SendableError;
}): FastifyReply {
    const { reply, request, error } = input;
    const routingOptions = getRoutingOptions(request);
    return sendError({
        reply,
        request,
        error,
        ...(routingOptions?.showStackTrace !== undefined && {
            showStackTrace: routingOptions.showStackTrace
        }),
        ...(routingOptions?.errorLoggerHook !== undefined && {
            errorLoggerHook: routingOptions.errorLoggerHook
        })
    });
}
