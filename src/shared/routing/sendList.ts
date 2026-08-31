import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import type { SendableError } from "./abstractions/index.js";
import { handleResultError } from "./handleResultError.js";

interface SendListParams<TResponse> {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<TResponse, SendableError>;
    status?: number;
}

export function sendList<TResponse>(params: SendListParams<TResponse>): FastifyReply {
    const { reply, request, result, status } = params;

    if (result.isFail()) {
        return handleResultError({ reply, request, error: result.error });
    }

    return reply.status(status ?? 200).send(result.value);
}
