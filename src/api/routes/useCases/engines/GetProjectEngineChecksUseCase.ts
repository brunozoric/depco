import { Result } from "#shared/index.js";
import { EngineService } from "#api/services/Engine/index.js";
import { GetProjectEngineChecksUseCase as Abstraction } from "./abstractions/GetProjectEngineChecksUseCase.js";

class GetProjectEngineChecksUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly engineService: EngineService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const items = await this.engineService.getByProject(params.projectId);
            return Result.ok({ items, total: items.length });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetProjectEngineChecksUseCase = Abstraction.createImplementation({
    implementation: GetProjectEngineChecksUseCaseImpl,
    dependencies: [EngineService]
});
