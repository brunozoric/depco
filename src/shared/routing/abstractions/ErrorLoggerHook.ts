import type { FastifyRequest } from "fastify";
import { createAbstraction } from "#shared/index.js";
import type { SendableError } from "./SendableError.js";

interface IErrorLoggerHook {
    log(error: SendableError, request: FastifyRequest): Promise<void>;
}

export const ErrorLoggerHook = createAbstraction<IErrorLoggerHook>("Routing/ErrorLoggerHook");

export namespace ErrorLoggerHook {
    export type Interface = IErrorLoggerHook;
}
