import { Result } from "#shared/index.js";
import { AutoFixSettingsService } from "#api/services/AutoFix/index.js";
import { GetAutoFixSettingsUseCase as Abstraction } from "./abstractions/GetAutoFixSettingsUseCase.js";

class GetAutoFixSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly autoFixSettingsService: AutoFixSettingsService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const settings = await this.autoFixSettingsService.getSettingsOrDefaults(
                params.projectId
            );
            return Result.ok(settings);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetAutoFixSettingsUseCase = Abstraction.createImplementation({
    implementation: GetAutoFixSettingsUseCaseImpl,
    dependencies: [AutoFixSettingsService]
});
