import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules } from "#api/db/schema.js";
import { CreateLicensePolicyUseCase as Abstraction } from "./abstractions/CreateLicensePolicyUseCase.js";

class CreateLicensePolicyUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const now = Date.now();

            const rule = {
                id: generateId(),
                action: params.action,
                licensePattern: params.licensePattern ?? null,
                packagePattern: params.packagePattern ?? null,
                projectId: params.projectId ?? null,
                priority: params.priority,
                reason: params.reason ?? null,
                createdAt: now,
                updatedAt: now
            };

            await db.insert(licensePolicyRules).values(rule).run();

            return Result.ok(rule);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const CreateLicensePolicyUseCase = Abstraction.createImplementation({
    implementation: CreateLicensePolicyUseCaseImpl,
    dependencies: [DatabaseClient]
});
