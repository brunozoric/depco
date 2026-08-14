import { Result, unexpectedError } from "#shared/index.js";
import { VulnerabilityQueryService } from "#api/services/Vulnerability/index.js";
import { GetProjectVulnerabilitiesUseCase as Abstraction } from "./abstractions/GetProjectVulnerabilitiesUseCase.js";

class GetProjectVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly vulnerabilityQueryService: VulnerabilityQueryService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.vulnerabilityQueryService.listProjectVulnerabilities({
                projectId: params.projectId,
                query: params.query
            });
            return Result.ok(data);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetProjectVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: GetProjectVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilityQueryService]
});
