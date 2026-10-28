import type { FastifyInstance } from "fastify";
import { registerProjectCrudRoutes } from "./projects/projectCrudRoutes.js";
import { registerProjectBulkRoutes } from "./projects/projectBulkRoutes.js";
import { registerProjectDetailRoutes } from "./projects/projectDetailRoutes.js";

export async function projectRoutes(app: FastifyInstance): Promise<void> {
    registerProjectCrudRoutes(app);
    registerProjectBulkRoutes(app);
    registerProjectDetailRoutes(app);
}
