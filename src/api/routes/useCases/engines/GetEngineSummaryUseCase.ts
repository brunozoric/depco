import { Result, unexpectedError } from "#shared/index.js";
import { EngineService } from "#api/services/Engine/index.js";
import { GetEngineSummaryUseCase as Abstraction } from "./abstractions/GetEngineSummaryUseCase.js";

class GetEngineSummaryUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly engineService: EngineService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const summary = await this.engineService.getSummary();
            return Result.ok(summary);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetEngineSummaryUseCase = Abstraction.createImplementation({
    implementation: GetEngineSummaryUseCaseImpl,
    dependencies: [EngineService]
});
