import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { ConfigCheckCommandFeature } from "../feature.js";
import { ConfigCheckCommand } from "../abstractions/ConfigCheckCommand.js";
import { registerCliLogger } from "#testing/helpers/registerCliLogger.js";

describe("ConfigCheckCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        registerCliLogger(container);
        registerFeatures(container, [ConfigCheckCommandFeature]);
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
