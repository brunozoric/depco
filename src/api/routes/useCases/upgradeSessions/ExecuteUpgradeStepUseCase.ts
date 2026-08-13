import { Result } from "#shared/index.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { ExecuteUpgradeStepUseCase as Abstraction } from "./abstractions/ExecuteUpgradeStepUseCase.js";
import { mapUpgradeSessionErrorStatus } from "./upgradeSessionErrorMapper.js";

class ExecuteUpgradeStepUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly upgradeSessionService: UpgradeSessionService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const session = await this.upgradeSessionService.executeStep(
                params.sessionId,
                params.projectId,
                params.stepType,
                params.input
            );

            return Result.ok(session);
        } catch (error) {
            const message = (error as Error).message;
            return Result.fail({ statusCode: mapUpgradeSessionErrorStatus(message), message });
        }
    }
}

export const ExecuteUpgradeStepUseCase = Abstraction.createImplementation({
    implementation: ExecuteUpgradeStepUseCaseImpl,
    dependencies: [UpgradeSessionService]
});
