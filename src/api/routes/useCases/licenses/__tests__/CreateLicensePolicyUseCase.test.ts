import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { licensePolicyRules } from "#api/db/schema.js";
import { CreateLicensePolicyUseCase } from "../abstractions/CreateLicensePolicyUseCase.js";
import type { TestDb } from "./licensesUseCasesTestHelpers.js";

describe("CreateLicensePolicyUseCase", () => {
    let useCase: CreateLicensePolicyUseCase.Interface;
    let db: TestDb;

    function createUseCase(): CreateLicensePolicyUseCase.Interface {
        const created = createTestApiContainer();
        db = created.db;
        return created.container.resolve(CreateLicensePolicyUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("creates and persists a license policy rule", async () => {
        const params: CreateLicensePolicyUseCase.Params = {
            action: "deny",
            licensePattern: "GPL-*",
            priority: 1,
            reason: "no copyleft"
        };

        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }

        expect(result.value).toMatchObject({
            action: "deny",
            licensePattern: "GPL-*",
            packagePattern: null,
            projectId: null,
            priority: 1,
            reason: "no copyleft"
        });
        expect(typeof result.value.id).toBe("string");
        expect(result.value.id.length).toBeGreaterThan(0);
        expect(typeof result.value.createdAt).toBe("number");
        expect(typeof result.value.updatedAt).toBe("number");

        const persisted = await db
            .select()
            .from(licensePolicyRules)
            .where(eq(licensePolicyRules.id, result.value.id))
            .get();

        expect(persisted).toEqual(result.value);
    });
});
