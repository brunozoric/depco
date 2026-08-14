import { Result } from "#shared/index.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { AbortUpgradeSessionUseCase as Abstraction } from "./abstractions/AbortUpgradeSessionUseCase.js";
import { mapUpgradeSessionErrorStatus } from "./upgradeSessionErrorMapper.js";

class AbortUpgradeSessionUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly upgradeSessionService: UpgradeSessionService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const session = await this.upgradeSessionService.abortSession(
                params.sessionId,
                params.projectId
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

export const AbortUpgradeSessionUseCase = Abstraction.createImplementation({
    implementation: AbortUpgradeSessionUseCaseImpl,
    dependencies: [UpgradeSessionService]
});
