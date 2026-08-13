import { Result } from "#shared/index.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { CreateUpgradeSessionUseCase as Abstraction } from "./abstractions/CreateUpgradeSessionUseCase.js";
import { mapUpgradeSessionErrorStatus } from "./upgradeSessionErrorMapper.js";

class CreateUpgradeSessionUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly upgradeSessionService: UpgradeSessionService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const session = await this.upgradeSessionService.createSession(params.projectId);
            return Result.ok(session);
        } catch (error) {
            const message = (error as Error).message;
            return Result.fail({ statusCode: mapUpgradeSessionErrorStatus(message), message });
        }
    }
}

export const CreateUpgradeSessionUseCase = Abstraction.createImplementation({
    implementation: CreateUpgradeSessionUseCaseImpl,
    dependencies: [UpgradeSessionService]
});
