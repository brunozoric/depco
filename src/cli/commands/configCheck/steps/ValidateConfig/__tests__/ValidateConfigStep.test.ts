import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { ValidateConfigStepFeature } from "../feature.js";
import { ValidateConfigStep } from "../abstractions/ValidateConfigStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";
import { registerCliLogger } from "#testing/helpers/registerCliLogger.js";

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
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "validate-config-"));
        container = createContainer();
        registerCliLogger(container);
        ValidateConfigStepFeature.register(container);
        consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
        consoleInfoSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it("reports no config found and succeeds when depco.config.ts is missing", async () => {
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(consoleInfoSpy).toHaveBeenCalledWith(
            "No depco.config.ts found in current directory"
        );
    });

    it("reports valid when depco.config.ts matches the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["permissive"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(consoleInfoSpy).toHaveBeenCalledWith("depco.config.ts is valid");
    });

    it("reports failure when depco.config.ts cannot be loaded (import throws)", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            "export default (() => { throw new Error('syntax kaboom'); })();"
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(false);
        expect(result.message).toContain("Failed to load depco.config.ts");
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("syntax kaboom"));
    });

    it("handles non-Error thrown values during import", async () => {
        writeFileSync(join(workDir, "depco.config.ts"), 'throw "string error";');
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(false);
        expect(result.message).toContain("Failed to load depco.config.ts");
        expect(result.message).toContain("string error");
    });

    it("reports invalid and fails when depco.config.ts violates the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["invalid-tier"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith("depco.config.ts is invalid:");
        const loggedLines = consoleErrorSpy.mock.calls.map((call: unknown[]) => call[0] as string);
        expect(
            loggedLines.some((line: string) => line.includes("scan.license.allowedRiskTiers.0"))
        ).toBe(true);
    });
});
