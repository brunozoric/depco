import { Result } from "#shared/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { GetJobUseCase as Abstraction } from "./abstractions/GetJobUseCase.js";

class GetJobUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly jobWorker: JobWorker.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const job = await this.jobWorker.getJob(params.jobId);
        if (!job || job.referenceId !== params.projectId) {
            return Result.fail({ statusCode: 404, message: "Job not found" });
        }

        return Result.ok(job);
    }
}

export const GetJobUseCase = Abstraction.createImplementation({
    implementation: GetJobUseCaseImpl,
    dependencies: [JobWorker]
});
