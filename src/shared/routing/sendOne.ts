import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import type { SendableError } from "./abstractions/index.js";
import { handleResultError } from "./handleResultError.js";

type UnwrapItem<T> = T extends { item: infer I } ? I : T;

interface SendOneParams<TResponse> {
    reply: FastifyReply;
    request: FastifyRequest;
    result: Result<UnwrapItem<TResponse>, SendableError>;
    status?: number;
}

export function sendOne<TResponse>(params: SendOneParams<TResponse>): FastifyReply {
    const { reply, request, result, status } = params;

    if (result.isFail()) {
        return handleResultError({ reply, request, error: result.error });
    }

    return reply.status(status ?? 200).send({ item: result.value });
}
