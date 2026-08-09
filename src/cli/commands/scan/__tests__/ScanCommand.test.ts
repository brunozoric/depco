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

    it("returns 3 steps in correct order", () => {
        const command = container.resolve(ScanCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(3);
        expect(steps.map(step => step.name)).toEqual([
            "detect-package-manager",
            "parse-lockfile",
            "check-licenses"
        ]);
    });

    it("returns context with cwd as dataDirectory", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe(process.cwd());
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(ScanCommand);
        expect(command.name).toBe("scan");
        expect(command.description).toBeTruthy();
    });
});
