import type { FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";

export interface IPluginOptions extends FastifyPluginOptions {
    container: Container;
}
