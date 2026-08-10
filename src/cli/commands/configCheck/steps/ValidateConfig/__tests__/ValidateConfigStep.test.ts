import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { ValidateConfigStepFeature } from "../feature.js";
import { ValidateConfigStep } from "../abstractions/ValidateConfigStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("ValidateConfigStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "validate-config-"));
        container = createContainer();
        ValidateConfigStepFeature.register(container);
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
        consoleLogSpy.mockRestore();
    });

    it("reports no config found and succeeds when depco.config.ts is missing", async () => {
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith("No depco.config.ts found in current directory");
    });

    it("reports valid when depco.config.ts matches the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["permissive"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith("depco.config.ts is valid");
    });

    it("reports invalid and fails when depco.config.ts violates the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["invalid-tier"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith("depco.config.ts is invalid:");
        const loggedLines = consoleLogSpy.mock.calls.map(call => call[0] as string);
        expect(loggedLines.some(line => line.includes("scan.license.allowedRiskTiers.0"))).toBe(
            true
        );
    });
});
