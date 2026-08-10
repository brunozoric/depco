import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerProjectCrudRoutes } from "./projects/projectCrudRoutes.js";
import { registerProjectBulkRoutes } from "./projects/projectBulkRoutes.js";
import { registerProjectDetailRoutes } from "./projects/projectDetailRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function projectRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    registerProjectCrudRoutes(app, container);
    registerProjectBulkRoutes(app, container);
    registerProjectDetailRoutes(app, container);
}
