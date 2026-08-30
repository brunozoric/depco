import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute, sendError, sendBlob } from "#shared/routing/index.js";
import { exportAllSbomRoute, exportProjectSbomRoute } from "#shared/routes/index.js";
import { ExportAllSbomUseCase, ExportProjectSbomUseCase } from "./useCases/sbom/index.js";

export async function sbomRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;
    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, exportAllSbomRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ExportAllSbomUseCase);
        const result = await useCase.execute({ format: request.query.format });

        result.match({
            ok: data =>
                sendBlob({
                    reply,
                    content: data.content,
                    filename: data.filename,
                    mediaType: data.mediaType
                }),
            fail: error =>
                sendError({
                    reply,
                    request,
                    error
                })
        });
    });

    registerRoute(app, exportProjectSbomRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ExportProjectSbomUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            format: request.query.format
        });

        result.match({
            ok: data =>
                sendBlob({
                    reply,
                    content: data.content,
                    filename: data.filename,
                    mediaType: data.mediaType
                }),
            fail: error =>
                sendError({
                    reply,
                    request,
                    error
                })
        });
    });
}
