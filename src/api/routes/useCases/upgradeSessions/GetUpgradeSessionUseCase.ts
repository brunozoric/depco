import { Result } from "#shared/index.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { GetUpgradeSessionUseCase as Abstraction } from "./abstractions/GetUpgradeSessionUseCase.js";
import { mapUpgradeSessionErrorStatus } from "./upgradeSessionErrorMapper.js";

class GetUpgradeSessionUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly upgradeSessionService: UpgradeSessionService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const session = await this.upgradeSessionService.getSession(
                params.sessionId,
                params.projectId
            );
            if (!session) {
                return Result.fail({
                    code: "SESSION_NOT_FOUND",
                    statusCode: 404,
                    message: "Session not found"
                });
            }

            return Result.ok(session);
        } catch (error) {
            const message = (error as Error).message;
            return Result.fail({
                code: "SESSION_OPERATION",
                statusCode: mapUpgradeSessionErrorStatus(message),
                message
            });
        }
    }
}

export const GetUpgradeSessionUseCase = Abstraction.createImplementation({
    implementation: GetUpgradeSessionUseCaseImpl,
    dependencies: [UpgradeSessionService]
});
