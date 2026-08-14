import { Result, unexpectedError } from "#shared/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { CancelJobUseCase as Abstraction } from "./abstractions/CancelJobUseCase.js";

class CancelJobUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly jobWorker: JobWorker.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            const job = await this.jobWorker.getJob(params.jobId);
            if (!job) {
                return Result.fail({
                    code: "JOB_NOT_FOUND",
                    statusCode: 404,
                    message: "Job not found"
                });
            }

            await this.jobWorker.cancelJob(params.jobId);

            return Result.ok();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const CancelJobUseCase = Abstraction.createImplementation({
    implementation: CancelJobUseCaseImpl,
    dependencies: [JobWorker]
});
