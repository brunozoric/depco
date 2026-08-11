import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { InitCommandFeature } from "../feature.js";
import { InitCommand } from "../abstractions/InitCommand.js";
import { registerCliLogger } from "#testing/helpers/registerCliLogger.js";

describe("InitCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        registerCliLogger(container);
        registerFeatures(container, [InitCommandFeature]);
    });

    it("returns 7 steps in correct order", () => {
        const command = container.resolve(InitCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(7);
        expect(steps.map(step => step.name)).toEqual([
            "ensure-data-directory",
            "run-migrations",
            "generate-encryption-key",
            "select-port",
            "create-admin-user",
            "write-env-file",
            "print-next-steps"
        ]);
    });

    it("returns valid context", () => {
        const command = container.resolve(InitCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe("./data");
        expect(context.envFilePath).toBe("./.env");
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(InitCommand);
        expect(command.name).toBe("init");
        expect(command.description).toBeTruthy();
    });
});
