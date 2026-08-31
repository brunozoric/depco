import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import type { SendableError } from "./abstractions/index.js";
import { handleResultError } from "./handleResultError.js";

interface SendNoneParams {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<unknown, SendableError>;
    status?: number;
}

export function sendNone(params: SendNoneParams): FastifyReply {
    const { reply, request, result, status } = params;

    if (result.isFail()) {
        return handleResultError({ reply, request, error: result.error });
    }

    const statusCode = status ?? 200;

    if (statusCode === 204) {
        return reply.status(204).send();
    }

    return reply.status(statusCode).send({ success: true });
}
