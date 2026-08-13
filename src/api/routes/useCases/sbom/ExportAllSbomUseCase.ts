import { Result } from "#shared/index.js";
import { SbomService } from "#api/services/Sbom/index.js";
import { SbomFormatterRegistry } from "#api/services/Sbom/index.js";
import { ExportAllSbomUseCase as Abstraction } from "./abstractions/ExportAllSbomUseCase.js";

class ExportAllSbomUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly sbomService: SbomService.Interface,
        private readonly sbomFormatterRegistry: SbomFormatterRegistry.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const formatter = this.sbomFormatterRegistry.get(params.format);
            const data = await this.sbomService.collectForAllProjects();
            const result = formatter.format(data);

            return Result.ok(result);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ExportAllSbomUseCase = Abstraction.createImplementation({
    implementation: ExportAllSbomUseCaseImpl,
    dependencies: [SbomService, SbomFormatterRegistry]
});
