import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
    HTTPMethods,
    RouteShorthandOptions
} from "fastify";
import type { RouteDefinition, HTTPMethod } from "./defineRoute.js";
import type { z } from "zod";

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
        reply: FastifyReply
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
        handler: handler as (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
    });
}
