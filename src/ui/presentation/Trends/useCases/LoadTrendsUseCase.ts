import { LoadTrendsUseCase as Abstraction } from "./abstractions/LoadTrendsUseCase.js";
import { TrendsGateway } from "../../../features/Trends/abstractions/TrendsGateway.js";
import { TrendsRepository } from "../../../features/Trends/abstractions/TrendsRepository.js";

class LoadTrendsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: TrendsGateway.Interface,
        private readonly repository: TrendsRepository.Interface
    ) {}

    public execute = async (ranges: Abstraction.Ranges): Promise<void> => {
        const tasks: Promise<void>[] = [];

        if (ranges.staleness !== undefined) {
            tasks.push(
                (async () => {
                    const response = await this.gateway.getStalenessTrend(
                        ranges.staleness!,
                        ranges.teamId
                    );
                    this.repository.setStalenessTrend(response.points);
                })()
            );
        }

        if (ranges.license !== undefined) {
            tasks.push(
                (async () => {
                    const response = await this.gateway.getLicenseTrend(
                        ranges.license!,
                        ranges.teamId
                    );
                    this.repository.setLicenseTrend(response.points);
                })()
            );
        }

        if (ranges.autoFix !== undefined) {
            tasks.push(
                (async () => {
                    const response = await this.gateway.getAutoFixTrend(
                        ranges.autoFix!,
                        ranges.teamId
                    );
                    this.repository.setAutoFixTrend(response.points);
                })()
            );
        }

        await Promise.all(tasks);
    };
}

export const LoadTrendsUseCase = Abstraction.createImplementation({
    implementation: LoadTrendsUseCaseImpl,
    dependencies: [TrendsGateway, TrendsRepository]
});
