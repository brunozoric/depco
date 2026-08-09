import { ExportSbomUseCase as Abstraction } from "./abstractions/ExportSbomUseCase.js";
import { SbomGateway } from "../../../features/Sbom/abstractions/SbomGateway.js";
import { SbomRepository } from "../../../features/Sbom/abstractions/SbomRepository.js";
import { downloadBlob } from "#ui/infrastructure/Shared/download/downloadBlob.js";

class ExportSbomUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: SbomGateway.Interface,
        private readonly repository: SbomRepository.Interface
    ) {}

    public async exportProject(projectId: string, format: string): Promise<void> {
        const response = await this.gateway.exportProject(projectId, format);
        this.repository.setLastExport({
            format,
            timestamp: Date.now(),
            filename: response.filename
        });
        downloadBlob(response.blob, response.filename);
    }

    public async exportAll(format: string): Promise<void> {
        const response = await this.gateway.exportAll(format);
        this.repository.setLastExport({
            format,
            timestamp: Date.now(),
            filename: response.filename
        });
        downloadBlob(response.blob, response.filename);
    }
}

export const ExportSbomUseCase = Abstraction.createImplementation({
    implementation: ExportSbomUseCaseImpl,
    dependencies: [SbomGateway, SbomRepository]
});
