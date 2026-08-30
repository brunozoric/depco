import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerProjectCrudRoutes } from "./projects/projectCrudRoutes.js";
import { registerProjectBulkRoutes } from "./projects/projectBulkRoutes.js";
import { registerProjectDetailRoutes } from "./projects/projectDetailRoutes.js";

export async function projectRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;
    registerProjectCrudRoutes(app, container);
    registerProjectBulkRoutes(app, container);
    registerProjectDetailRoutes(app, container);
}
