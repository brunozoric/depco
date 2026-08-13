import { projects, licensePolicyRules } from "#api/db/schema.js";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";

export type TestDb = ReturnType<typeof createTestApiContainer>["db"];

export async function insertTestProject(
    db: TestDb,
    id: string,
    overrides: Partial<{ name: string; packageManager: string | null }> = {}
): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: overrides.name ?? id,
            path: `/repo/${id}`,
            packageManager: overrides.packageManager ?? "yarn",
            addedAt: Date.now()
        })
        .run();
}

export interface IInsertTestLicensePolicyRuleOverrides {
    action?: LicensePolicyAction;
    licensePattern?: string | null;
    packagePattern?: string | null;
    projectId?: string | null;
    priority?: number;
    reason?: string | null;
}

export async function insertTestLicensePolicyRule(
    db: TestDb,
    id: string,
    overrides: IInsertTestLicensePolicyRuleOverrides = {}
): Promise<void> {
    const now = Date.now();
    await db
        .insert(licensePolicyRules)
        .values({
            id,
            action: overrides.action ?? "warn",
            licensePattern: overrides.licensePattern ?? null,
            packagePattern: overrides.packagePattern ?? null,
            projectId: overrides.projectId ?? null,
            priority: overrides.priority ?? 0,
            reason: overrides.reason ?? null,
            createdAt: now,
            updatedAt: now
        })
        .run();
}
