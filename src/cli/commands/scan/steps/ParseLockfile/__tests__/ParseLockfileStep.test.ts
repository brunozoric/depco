import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { ParseLockfileStep } from "../abstractions/ParseLockfileStep.js";
import { LockfileParserService } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IDependencyEdge } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(): IStepContext {
    return {
        dataDirectory: "/fake/project",
        envFilePath: "./.env",
        options: {},
        results: new Map([["packageManager", "yarn"]])
    };
}

describe("ParseLockfileStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
    });

    it("extracts unique packages from dependency edges", async () => {
        const mockParser: LockfileParserService.Interface = {
            parse: vi.fn().mockResolvedValue([
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "react",
                    childVersion: "19.0.0",
                    dependencyType: "dependency",
                    depth: 0
                },
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "typescript",
                    childVersion: "7.0.2",
                    dependencyType: "devDependency",
                    depth: 0
                },
                {
                    parentPackage: "react",
                    parentVersion: "19.0.0",
                    childPackage: "loose-envify",
                    childVersion: "1.4.0",
                    dependencyType: "dependency",
                    depth: 1
                },
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "react",
                    childVersion: "19.0.0",
                    dependencyType: "dependency",
                    depth: 0
                }
            ] satisfies IDependencyEdge[])
        };
        container.registerInstance(LockfileParserService, mockParser);

        const step = container.resolve(ParseLockfileStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        const packages = context.results.get("packages") as Array<{
            name: string;
            version: string;
        }>;
        expect(packages).toHaveLength(3);
        expect(packages).toContainEqual({ name: "react", version: "19.0.0" });
        expect(packages).toContainEqual({ name: "typescript", version: "7.0.2" });
        expect(packages).toContainEqual({ name: "loose-envify", version: "1.4.0" });
    });

    it("fails when no packages found", async () => {
        const mockParser: LockfileParserService.Interface = {
            parse: vi.fn().mockResolvedValue([])
        };
        container.registerInstance(LockfileParserService, mockParser);

        const step = container.resolve(ParseLockfileStep);
        const context = createTestContext();
        const result = await step.execute(context);

        expect(result.success).toBe(false);
        expect(result.message).toContain("No packages found");
    });
});
