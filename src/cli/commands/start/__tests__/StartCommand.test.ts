import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { StartCommandFeature } from "../feature.js";
import { StartCommand } from "../abstractions/StartCommand.js";

describe("StartCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        registerFeatures(container, [StartCommandFeature]);
    });

    it("returns 2 steps in correct order", () => {
        const command = container.resolve(StartCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(2);
        expect(steps.map(step => step.name)).toEqual(["validate-environment", "start-server"]);
    });

    it("returns valid context", () => {
        const command = container.resolve(StartCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe("./data");
        expect(context.envFilePath).toBe("./.env");
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(StartCommand);
        expect(command.name).toBe("start");
        expect(command.description).toBeTruthy();
    });
});
