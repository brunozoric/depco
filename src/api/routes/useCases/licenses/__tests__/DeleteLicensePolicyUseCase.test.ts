import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { licensePolicyRules } from "#api/db/schema.js";
import { DeleteLicensePolicyUseCase } from "../abstractions/DeleteLicensePolicyUseCase.js";
import { insertTestLicensePolicyRule, type TestDb } from "./licensesUseCasesTestHelpers.js";

describe("DeleteLicensePolicyUseCase", () => {
    let useCase: DeleteLicensePolicyUseCase.Interface;
    let db: TestDb;

    function createUseCase(): DeleteLicensePolicyUseCase.Interface {
        const created = createTestApiContainer();
        db = created.db;
        return created.container.resolve(DeleteLicensePolicyUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("deletes an existing rule", async () => {
        await insertTestLicensePolicyRule(db, "rule-1");

        const result = await useCase.execute({ id: "rule-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: true });
        }

        const persisted = await db
            .select()
            .from(licensePolicyRules)
            .where(eq(licensePolicyRules.id, "rule-1"))
            .get();
        expect(persisted).toBeUndefined();
    });

    it("returns ok even when the rule does not exist", async () => {
        const result = await useCase.execute({ id: "never-existed" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: true });
        }
    });
});
