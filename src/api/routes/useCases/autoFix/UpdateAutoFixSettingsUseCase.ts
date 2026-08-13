import { Result } from "#shared/index.js";
import { AutoFixSettingsService } from "#api/services/AutoFix/index.js";
import { UpdateAutoFixSettingsUseCase as Abstraction } from "./abstractions/UpdateAutoFixSettingsUseCase.js";

class UpdateAutoFixSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly autoFixSettingsService: AutoFixSettingsService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const settings = await this.autoFixSettingsService.updateSettings(
                params.projectId,
                params.input
            );
            return Result.ok(settings);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdateAutoFixSettingsUseCase = Abstraction.createImplementation({
    implementation: UpdateAutoFixSettingsUseCaseImpl,
    dependencies: [AutoFixSettingsService]
});
