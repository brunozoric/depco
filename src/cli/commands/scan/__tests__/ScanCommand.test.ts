import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { ScanCommandFeature } from "../feature.js";
import { ScanCommand } from "../abstractions/ScanCommand.js";

describe("ScanCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        registerFeatures(container, [ScanCommandFeature]);
    });

    it("returns 5 steps in correct order", () => {
        const command = container.resolve(ScanCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(5);
        expect(steps.map(step => step.name)).toEqual([
            "detect-package-manager",
            "load-config",
            "parse-lockfile",
            "check-licenses",
            "check-vulnerabilities"
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

    it("forwards argv.check into context.options", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context({ check: "vulnerability" });
        expect(context.options["check"]).toBe("vulnerability");
    });

    it("has correct name and description", () => {
        const command = container.resolve(ScanCommand);
        expect(command.name).toBe("scan");
        expect(command.description).toBeTruthy();
    });
});
