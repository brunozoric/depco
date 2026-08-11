import { describe, it, expect, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { ConfigCheckCommand } from "../abstractions/ConfigCheckCommand.js";

describe("ConfigCheckCommand", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
    });

    it("returns 1 step", () => {
        const command = container.resolve(ConfigCheckCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(1);
        expect(steps.map(step => step.name)).toEqual(["validate-config"]);
    });

    it("returns context with cwd as dataDirectory", () => {
        const command = container.resolve(ConfigCheckCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe(process.cwd());
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(ConfigCheckCommand);
        expect(command.name).toBe("config-check");
        expect(command.description).toBeTruthy();
    });
});
