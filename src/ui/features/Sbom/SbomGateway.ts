import { SbomGateway as Abstraction } from "./abstractions/SbomGateway.js";
import { interpolatePath } from "#shared/routing/index.js";
import { exportProjectSbomRoute, exportAllSbomRoute } from "#shared/routes/index.js";

function extractFilename(response: Response): string {
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return match?.[1] ?? "sbom.json";
}

class SbomGatewayImpl implements Abstraction.Interface {
    public async exportProject(
        projectId: string,
        format: string
    ): Promise<Abstraction.ExportResponse> {
        const path = interpolatePath(exportProjectSbomRoute.path, { projectId });
        const response = await fetch(`${path}?format=${format}`);
        if (!response.ok) {
            throw new Error(`SBOM export failed: ${response.status}`);
        }
        const blob = await response.blob();
        return { blob, filename: extractFilename(response) };
    }

    public async exportAll(format: string): Promise<Abstraction.ExportResponse> {
        const response = await fetch(`${exportAllSbomRoute.path}?format=${format}`);
        if (!response.ok) {
            throw new Error(`SBOM export failed: ${response.status}`);
        }
        const blob = await response.blob();
        return { blob, filename: extractFilename(response) };
    }
}

export const SbomGateway = Abstraction.createImplementation({
    implementation: SbomGatewayImpl,
    dependencies: []
});
