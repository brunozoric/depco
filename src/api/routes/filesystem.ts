import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { browseFilesystemRoute, scanFilesystemRoute } from "#shared/routes/index.js";
import { BrowseFilesystemUseCase, ScanFilesystemUseCase } from "./useCases/filesystem/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function filesystemRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    // GET /api/filesystem/browse — list directories at a given path
    // (defaults to cwd), used by the folder browser UI.
    registerRoute(app, browseFilesystemRoute, {}, async (request, reply) => {
        const useCase = container.resolve(BrowseFilesystemUseCase);
        const result = await useCase.execute({
            path: request.query.path,
            showHidden: request.query.showHidden
        });

        return sendList({
            reply,
            request,
            result,
            route: browseFilesystemRoute
        });
    });

    // GET /api/filesystem/scan — scan for subdirectories containing package.json.
    // Tries workspace resolution (package.json "workspaces" field) first; falls
    // back to a recursive scan up to the requested depth, excluding
    // node_modules/.git/hidden dirs and already-registered projects.
    registerRoute(app, scanFilesystemRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ScanFilesystemUseCase);
        const result = await useCase.execute({
            path: request.query.path,
            depth: request.query.depth
        });

        return sendList({
            reply,
            request,
            result,
            route: scanFilesystemRoute
        });
    });
}
