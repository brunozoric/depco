import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendListParams<TResponse> {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<TResponse, SendableError>;
    route?: { response?: z.ZodType };
    status?: number;
}

export function sendList<TResponse>(params: SendListParams<TResponse>): FastifyReply {
    const { reply, request, result, route, status } = params;

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

    if (route?.response) {
        const validation = route.response.safeParse(result.value);
        if (!validation.success) {
            process.stderr.write(
                `[sendList] Response validation failed: ${validation.error.message}\n`
            );
        }
    }

    return reply.status(status ?? 200).send(result.value);
}
