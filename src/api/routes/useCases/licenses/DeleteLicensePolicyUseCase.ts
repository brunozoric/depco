import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules } from "#api/db/schema.js";
import { DeleteLicensePolicyUseCase as Abstraction } from "./abstractions/DeleteLicensePolicyUseCase.js";

class DeleteLicensePolicyUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            await db.delete(licensePolicyRules).where(eq(licensePolicyRules.id, params.id)).run();
            return Result.ok({ deleted: true });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const DeleteLicensePolicyUseCase = Abstraction.createImplementation({
    implementation: DeleteLicensePolicyUseCaseImpl,
    dependencies: [DatabaseClient]
});
