import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules } from "#api/db/schema.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";
import { UpdateLicensePolicyUseCase as Abstraction } from "./abstractions/UpdateLicensePolicyUseCase.js";

class UpdateLicensePolicyUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        let existing;
        try {
            const { db } = this.databaseClient;
            existing = await db
                .select()
                .from(licensePolicyRules)
                .where(eq(licensePolicyRules.id, params.id))
                .get();
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }

        if (!existing) {
            return Result.fail({ statusCode: 404, message: "License policy rule not found" });
        }

        try {
            const { db } = this.databaseClient;
            const updates = {
                action: params.action ?? (existing.action as LicensePolicyAction),
                licensePattern:
                    params.licensePattern !== undefined
                        ? params.licensePattern
                        : existing.licensePattern,
                packagePattern:
                    params.packagePattern !== undefined
                        ? params.packagePattern
                        : existing.packagePattern,
                projectId: params.projectId !== undefined ? params.projectId : existing.projectId,
                priority: params.priority ?? existing.priority,
                reason: params.reason !== undefined ? params.reason : existing.reason,
                updatedAt: Date.now()
            };

            await db
                .update(licensePolicyRules)
                .set(updates)
                .where(eq(licensePolicyRules.id, params.id))
                .run();

            return Result.ok({ ...existing, ...updates });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdateLicensePolicyUseCase = Abstraction.createImplementation({
    implementation: UpdateLicensePolicyUseCaseImpl,
    dependencies: [DatabaseClient]
});
