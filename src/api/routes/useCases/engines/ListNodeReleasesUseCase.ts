import { Result, unexpectedError } from "#shared/index.js";
import { NodeReleaseDataService } from "#api/services/Engine/index.js";
import { ListNodeReleasesUseCase as Abstraction } from "./abstractions/ListNodeReleasesUseCase.js";

class ListNodeReleasesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly nodeReleaseDataService: NodeReleaseDataService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const items = await this.nodeReleaseDataService.getSchedule();
            return Result.ok({ items, total: items.length });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListNodeReleasesUseCase = Abstraction.createImplementation({
    implementation: ListNodeReleasesUseCaseImpl,
    dependencies: [NodeReleaseDataService]
});
