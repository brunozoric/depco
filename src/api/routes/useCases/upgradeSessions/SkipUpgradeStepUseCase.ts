import { Result } from "#shared/index.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { SkipUpgradeStepUseCase as Abstraction } from "./abstractions/SkipUpgradeStepUseCase.js";
import { mapUpgradeSessionErrorStatus } from "./upgradeSessionErrorMapper.js";

class SkipUpgradeStepUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly upgradeSessionService: UpgradeSessionService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const session = await this.upgradeSessionService.skipStep(
                params.sessionId,
                params.projectId,
                params.stepType
            );

            return Result.ok(session);
        } catch (error) {
            const message = (error as Error).message;
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: mapUpgradeSessionErrorStatus(message),
                message
            });
        }
    }
}

export const SkipUpgradeStepUseCase = Abstraction.createImplementation({
    implementation: SkipUpgradeStepUseCaseImpl,
    dependencies: [UpgradeSessionService]
});
