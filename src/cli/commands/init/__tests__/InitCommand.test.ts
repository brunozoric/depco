import { describe, it, expect, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { InitCommand } from "../abstractions/InitCommand.js";

describe("InitCommand", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
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
