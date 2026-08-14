import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { licensePolicyRules } from "#api/db/schema.js";
import { UpdateLicensePolicyUseCase } from "../abstractions/UpdateLicensePolicyUseCase.js";
import { insertTestLicensePolicyRule, type TestDb } from "./licensesUseCasesTestHelpers.js";

describe("UpdateLicensePolicyUseCase", () => {
    let useCase: UpdateLicensePolicyUseCase.Interface;
    let db: TestDb;

    function createUseCase(): UpdateLicensePolicyUseCase.Interface {
        const created = createTestApiContainer();
        db = created.db;
        return created.container.resolve(UpdateLicensePolicyUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("partially updates a rule and retains fields not passed in", async () => {
        await insertTestLicensePolicyRule(db, "rule-1", {
            action: "warn",
            licensePattern: "MIT",
            priority: 1,
            reason: "initial"
        });

        const result = await useCase.execute({ id: "rule-1", priority: 5 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toMatchObject({
                id: "rule-1",
                action: "warn",
                licensePattern: "MIT",
                priority: 5,
                reason: "initial"
            });
        }

        const persisted = await db
            .select()
            .from(licensePolicyRules)
            .where(eq(licensePolicyRules.id, "rule-1"))
            .get();
        expect(persisted).toMatchObject({ priority: 5, action: "warn", licensePattern: "MIT" });
    });

    it("fails with 404 when the rule does not exist", async () => {
        const result = await useCase.execute({ id: "does-not-exist", priority: 1 });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "POLICY_NOT_FOUND",
                statusCode: 404,
                message: "License policy rule not found"
            });
        }
    });

    it("allows an explicit null to override an existing value", async () => {
        await insertTestLicensePolicyRule(db, "rule-2", { licensePattern: "MIT" });

        const result = await useCase.execute({ id: "rule-2", licensePattern: null });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.licensePattern).toBeNull();
        }

        const persisted = await db
            .select()
            .from(licensePolicyRules)
            .where(eq(licensePolicyRules.id, "rule-2"))
            .get();
        expect(persisted?.licensePattern).toBeNull();
    });
});
