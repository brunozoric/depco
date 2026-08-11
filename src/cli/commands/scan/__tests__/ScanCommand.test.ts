import { describe, it, expect, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { ScanCommand } from "../abstractions/ScanCommand.js";

describe("ScanCommand", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
    });

    it("returns 6 steps in correct order", () => {
        const command = container.resolve(ScanCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(6);
        expect(steps.map(step => step.name)).toEqual([
            "detect-package-manager",
            "load-config",
            "parse-lockfile",
            "check-licenses",
            "check-vulnerabilities",
            "render-output"
        ]);
    });

    it("returns context with cwd as dataDirectory", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe(process.cwd());
        expect(context.results).toBeInstanceOf(Map);
    });

    it("defaults options.check to 'license' when no argv is given", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.options["check"]).toBe("license");
    });

    it("defaults options.format to 'table' when no argv is given", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.options["format"]).toBe("table");
    });

    it("forwards argv.check into context.options", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context({ check: "vulnerability" });
        expect(context.options["check"]).toBe("vulnerability");
    });

    it("forwards argv.format into context.options", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context({ format: "json" });
        expect(context.options["format"]).toBe("json");
    });

    it("forwards argv.output into context.options", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context({ output: "results.json" });
        expect(context.options["output"]).toBe("results.json");
    });

    it("leaves options.output undefined when no --output is given", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.options["output"]).toBeUndefined();
    });

    it("has correct name and description", () => {
        const command = container.resolve(ScanCommand);
        expect(command.name).toBe("scan");
        expect(command.description).toBeTruthy();
    });
});
