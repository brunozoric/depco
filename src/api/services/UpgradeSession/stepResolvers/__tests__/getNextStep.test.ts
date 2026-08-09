import { describe, it, expect } from "vitest";
import { getNextStep, STEP_ORDER } from "../abstractions/StepResolver.js";

describe("getNextStep", () => {
    it("returns next step from default order", () => {
        const order = [...STEP_ORDER];
        expect(getNextStep("select-packages", order)).toBe("branch");
        expect(getNextStep("branch", order)).toBe("upgrade");
    });

    it("returns null for last step", () => {
        const order = [...STEP_ORDER];
        expect(getNextStep("create-pr", order)).toBeNull();
    });

    it("returns null for unknown step", () => {
        const order = [...STEP_ORDER];
        expect(getNextStep("nonexistent", order)).toBeNull();
    });

    it("navigates custom step order", () => {
        const order = [
            "pre:select-packages:stop-server",
            "select-packages",
            "branch",
            "pre:upgrade:lint-check",
            "upgrade",
            "post:upgrade:lint-fix",
            "refresh-transient",
            "commit",
            "post:commit:notify"
        ];

        expect(getNextStep("pre:select-packages:stop-server", order)).toBe("select-packages");
        expect(getNextStep("upgrade", order)).toBe("post:upgrade:lint-fix");
        expect(getNextStep("post:commit:notify", order)).toBeNull();
    });
});
