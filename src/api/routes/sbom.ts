import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError, sendBlob } from "#shared/routing/index.js";
import { exportAllSbomRoute, exportProjectSbomRoute } from "#shared/routes/index.js";
import { ExportAllSbomUseCase, ExportProjectSbomUseCase } from "./useCases/sbom/index.js";

export async function sbomRoutes(
    app: FastifyInstance,
    { container }: { container: Container }
): Promise<void> {
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
                sendError({ reply, statusCode: error.statusCode, message: error.message })
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
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
