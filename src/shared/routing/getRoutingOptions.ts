import type { FastifyRequest } from "fastify";
import type { RoutingOptions } from "./abstractions/index.js";

export function getRoutingOptions(request: FastifyRequest): RoutingOptions | undefined {
    return (request as unknown as { routingOptions?: RoutingOptions }).routingOptions;
}
