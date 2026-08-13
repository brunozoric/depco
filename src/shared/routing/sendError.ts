import type { FastifyReply, FastifyRequest } from "fastify";
import type { SendableError } from "./abstractions/index.js";
import type { ErrorLoggerHook } from "./abstractions/index.js";

interface SendErrorParams {
    reply: FastifyReply;
    request: FastifyRequest;
    error: SendableError;
    showStackTrace?: boolean;
    errorLoggerHook?: ErrorLoggerHook.Interface;
}

export function sendError(params: SendErrorParams): FastifyReply {
    const { reply, request, error, showStackTrace, errorLoggerHook } = params;

    if (errorLoggerHook !== undefined) {
        errorLoggerHook.log(error, request).catch(() => {});
    }

    const errorBody: Record<string, unknown> = {
        code: error.code,
        message: error.message
    };

    if (error.data !== undefined) {
        errorBody["data"] = error.data;
    }

    if (error.stack !== undefined && showStackTrace === true) {
        errorBody["stack"] = error.stack;
    }

    return reply.status(error.statusCode ?? 400).send({ error: errorBody });
}
