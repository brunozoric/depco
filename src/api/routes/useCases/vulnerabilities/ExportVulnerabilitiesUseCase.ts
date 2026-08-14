import { Result } from "#shared/index.js";
import { VulnerabilityQueryService } from "#api/services/Vulnerability/index.js";
import { ExportVulnerabilitiesUseCase as Abstraction } from "./abstractions/ExportVulnerabilitiesUseCase.js";

class ExportVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly vulnerabilityQueryService: VulnerabilityQueryService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.vulnerabilityQueryService.exportVulnerabilities(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ExportVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: ExportVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilityQueryService]
});
