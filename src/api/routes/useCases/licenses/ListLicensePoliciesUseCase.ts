import { and } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules } from "#api/db/schema.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";
import { ListLicensePoliciesUseCase as Abstraction } from "./abstractions/ListLicensePoliciesUseCase.js";
import { buildLicensePolicyConditions } from "./licensePolicyConditions.js";

class ListLicensePoliciesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const conditions = buildLicensePolicyConditions(params);

            const rows =
                conditions.length > 0
                    ? await db
                          .select()
                          .from(licensePolicyRules)
                          .where(and(...conditions))
                          .all()
                    : await db.select().from(licensePolicyRules).all();

            const items = rows.map(row => ({
                ...row,
                action: row.action as LicensePolicyAction
            }));

            return Result.ok({ items });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ListLicensePoliciesUseCase = Abstraction.createImplementation({
    implementation: ListLicensePoliciesUseCaseImpl,
    dependencies: [DatabaseClient]
});
