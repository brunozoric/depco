import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
    HTTPMethods,
    RouteShorthandOptions
} from "fastify";
import type { RouteDefinition, HTTPMethod } from "./defineRoute.js";
import type { z } from "zod";
import type { Result } from "#shared/index.js";
import type { SendableError } from "./abstractions/index.js";
import { sendOne } from "./sendOne.js";
import { sendList } from "./sendList.js";
import { sendNone } from "./sendNone.js";

type UnwrapItem<T> = T extends { item: infer I } ? I : T;

export interface IRouteSend<TResponse> {
    one(params: {
        result: Result<UnwrapItem<TResponse>, SendableError>;
        status?: number;
    }): FastifyReply;
    list(params: { result: Result<TResponse, SendableError>; status?: number }): FastifyReply;
    none(params: { result: Result<unknown, SendableError>; status?: number }): FastifyReply;
}

export function registerRoute<
    TPath extends string,
    TParams,
    TBody,
    TResponse,
    TMethod extends HTTPMethod,
    TQuerystring = never
>(
    app: FastifyInstance,
    route: RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>,
    options: Omit<RouteShorthandOptions, "schema">,
    handler: (
        request: FastifyRequest<{
            Params: TParams;
            Body: [TBody] extends [never] ? unknown : TBody;
            Querystring: [TQuerystring] extends [never] ? unknown : TQuerystring;
        }>,
        reply: FastifyReply,
        send: IRouteSend<TResponse>
    ) => Promise<unknown>
): void {
    const preValidation = async (request: FastifyRequest): Promise<void> => {
        const paramsResult = (route.params as z.ZodType).safeParse(request.params);
        if (!paramsResult.success) {
            throw Object.assign(new Error("Validation failed: params"), {
                statusCode: 400,
                validation: paramsResult.error.issues
            });
        }
        request.params = paramsResult.data;

        if (route.body) {
            const bodyResult = (route.body as z.ZodType).safeParse(request.body);
            if (!bodyResult.success) {
                throw Object.assign(new Error("Validation failed: body"), {
                    statusCode: 400,
                    validation: bodyResult.error.issues
                });
            }
            request.body = bodyResult.data;
        }

        if (route.querystring) {
            const queryResult = (route.querystring as z.ZodType).safeParse(request.query);
            if (!queryResult.success) {
                throw Object.assign(new Error("Validation failed: querystring"), {
                    statusCode: 400,
                    validation: queryResult.error.issues
                });
            }
            request.query = queryResult.data;
        }
    };

    const existingPreValidation = options.preValidation;
    const mergedPreValidation = existingPreValidation
        ? [
              preValidation,
              ...(Array.isArray(existingPreValidation)
                  ? existingPreValidation
                  : [existingPreValidation])
          ]
        : [preValidation];

    app.route({
        method: route.method as HTTPMethods,
        url: route.path,
        ...options,
        preValidation: mergedPreValidation,
        handler: ((request: FastifyRequest, reply: FastifyReply) => {
            const send: IRouteSend<TResponse> = {
                one: params => sendOne({ reply, request, ...params }),
                list: params => sendList({ reply, request, ...params }),
                none: params => sendNone({ reply, request, ...params })
            };

            return handler(
                request as FastifyRequest<{
                    Params: TParams;
                    Body: [TBody] extends [never] ? unknown : TBody;
                    Querystring: [TQuerystring] extends [never] ? unknown : TQuerystring;
                }>,
                reply,
                send
            );
        }) as (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
    });
}
