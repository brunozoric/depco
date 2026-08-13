import { eq, type SQL } from "drizzle-orm";
import { licensePolicyRules } from "#api/db/schema.js";

export interface ILicensePolicyFilters {
    projectId?: string | undefined;
}

export function buildLicensePolicyConditions(filters: ILicensePolicyFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.projectId) {
        conditions.push(eq(licensePolicyRules.projectId, filters.projectId));
    }
    return conditions;
}
