import { describe, it, expect, beforeEach } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ListLicensePoliciesUseCase } from "../abstractions/ListLicensePoliciesUseCase.js";
import {
    insertTestLicensePolicyRule,
    insertTestProject,
    type TestDb
} from "./licensesUseCasesTestHelpers.js";

describe("ListLicensePoliciesUseCase", () => {
    let useCase: ListLicensePoliciesUseCase.Interface;
    let db: TestDb;

    function createUseCase(): ListLicensePoliciesUseCase.Interface {
        const created = createTestApiContainer();
        db = created.db;
        return created.container.resolve(ListLicensePoliciesUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("returns all policy rules when no projectId filter is given", async () => {
        await insertTestProject(db, "proj-a");
        await insertTestProject(db, "proj-b");
        await insertTestLicensePolicyRule(db, "rule-a", { projectId: "proj-a" });
        await insertTestLicensePolicyRule(db, "rule-global", { projectId: null });
        await insertTestLicensePolicyRule(db, "rule-b", { projectId: "proj-b" });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const ids = result.value.items.map(item => item.id).sort();
            expect(ids).toEqual(["rule-a", "rule-b", "rule-global"]);
        }
    });

    it("filters policy rules by projectId", async () => {
        await insertTestProject(db, "proj-a");
        await insertTestProject(db, "proj-b");
        await insertTestLicensePolicyRule(db, "rule-a", { projectId: "proj-a" });
        await insertTestLicensePolicyRule(db, "rule-global", { projectId: null });
        await insertTestLicensePolicyRule(db, "rule-b", { projectId: "proj-b" });

        const result = await useCase.execute({ projectId: "proj-a" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]).toMatchObject({ id: "rule-a", projectId: "proj-a" });
        }
    });
});
