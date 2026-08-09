import { describe, it, expect } from "vitest";
import { buildStepOrder, createSessionSteps, toSlug } from "../stepPipeline.js";
import type { IResolvedStepHook } from "../../../StepHook/index.js";

describe("toSlug", () => {
    it("kebab-cases a name", () => {
        expect(toSlug("Run lint fix")).toBe("run-lint-fix");
    });

    it("strips non-alphanumeric characters", () => {
        expect(toSlug("Notify (team)!")).toBe("notify-team");
    });

    it("collapses multiple hyphens", () => {
        expect(toSlug("a  --  b")).toBe("a-b");
    });
});

describe("buildStepOrder", () => {
    it("returns default order with no hooks", () => {
        const order = buildStepOrder([]);
        expect(order).toEqual([
            "select-packages",
            "branch",
            "upgrade",
            "refresh-transient",
            "commit",
            "push",
            "create-pr"
        ]);
    });

    it("interleaves pre and post hooks", () => {
        const hooks: IResolvedStepHook[] = [
            {
                position: "pre:upgrade",
                name: "Lint",
                command: "eslint .",
                executionType: "command",
                required: true,
                source: "db"
            },
            {
                position: "post:commit",
                name: "Notify",
                command: "./notify.sh",
                executionType: "script",
                required: false,
                source: "db"
            }
        ];

        const order = buildStepOrder(hooks);
        expect(order).toEqual([
            "select-packages",
            "branch",
            "pre:upgrade:lint",
            "upgrade",
            "refresh-transient",
            "commit",
            "post:commit:notify",
            "push",
            "create-pr"
        ]);
    });

    it("places multiple hooks for same position in order", () => {
        const hooks: IResolvedStepHook[] = [
            {
                position: "pre:upgrade",
                name: "First",
                command: "echo 1",
                executionType: "command",
                required: false,
                source: "db"
            },
            {
                position: "pre:upgrade",
                name: "Second",
                command: "echo 2",
                executionType: "command",
                required: false,
                source: "db"
            }
        ];

        const order = buildStepOrder(hooks);
        const upgradeIndex = order.indexOf("upgrade");
        expect(order[upgradeIndex - 2]).toBe("pre:upgrade:first");
        expect(order[upgradeIndex - 1]).toBe("pre:upgrade:second");
    });
});

describe("createSessionSteps", () => {
    it("creates step states matching step order", () => {
        const hooks: IResolvedStepHook[] = [
            {
                position: "pre:upgrade",
                name: "Lint",
                command: "eslint .",
                executionType: "command",
                required: true,
                source: "db"
            }
        ];

        const order = buildStepOrder(hooks);
        const steps = createSessionSteps(order, hooks);

        expect(steps).toHaveLength(8);
        expect(steps[0]!.status).toBe("active");
        expect(steps[1]!.status).toBe("pending");

        const customStep = steps.find(s => s.type === "pre:upgrade:lint");
        expect(customStep).toBeDefined();
        expect(customStep!.input).toEqual(
            expect.objectContaining({
                name: "Lint",
                command: "eslint .",
                executionType: "command"
            })
        );
    });
});
