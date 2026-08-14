import { Result } from "#shared/index.js";
import { EngineService } from "#api/services/Engine/index.js";
import { GetEngineSummaryUseCase as Abstraction } from "./abstractions/GetEngineSummaryUseCase.js";

class GetEngineSummaryUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly engineService: EngineService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const summary = await this.engineService.getSummary();
            return Result.ok(summary);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetEngineSummaryUseCase = Abstraction.createImplementation({
    implementation: GetEngineSummaryUseCaseImpl,
    dependencies: [EngineService]
});
