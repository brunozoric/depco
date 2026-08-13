import { Result } from "#shared/index.js";
import { VulnerabilityQueryService } from "#api/services/Vulnerability/index.js";
import { ListVulnerabilitiesUseCase as Abstraction } from "./abstractions/ListVulnerabilitiesUseCase.js";

class ListVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly vulnerabilityQueryService: VulnerabilityQueryService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.vulnerabilityQueryService.listVulnerabilities(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ListVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: ListVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilityQueryService]
});
