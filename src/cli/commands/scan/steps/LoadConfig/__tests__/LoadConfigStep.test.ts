import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { LoadConfigStepFeature } from "../feature.js";
import { LoadConfigStep } from "../abstractions/LoadConfigStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";
import type { IDepcoConfig } from "#shared/config/types.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("LoadConfigStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "load-config-"));
        container = createContainer();
        LoadConfigStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("loads config from depco.config.ts", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["permissive", "weak-copyleft"] } } };`
        );
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const config = context.results.get("config") as IDepcoConfig;
        expect(config.scan?.license?.allowedRiskTiers).toEqual(["permissive", "weak-copyleft"]);
    });

    it("returns empty config when no file exists", async () => {
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        const config = context.results.get("config") as IDepcoConfig;
        expect(config).toEqual({});
    });

    it("fails on invalid config", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["invalid-tier"] } } };`
        );
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(false);
    });
});
