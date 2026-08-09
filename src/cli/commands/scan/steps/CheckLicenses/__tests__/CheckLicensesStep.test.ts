import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { CheckLicensesStepFeature } from "../feature.js";
import { CheckLicensesStep } from "../abstractions/CheckLicensesStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(packages: Array<{ name: string; version: string }>): IStepContext {
    return {
        dataDirectory: "/fake",
        envFilePath: "./.env",
        options: {},
        results: new Map([["packages", packages]])
    };
}

describe("CheckLicensesStep", () => {
    let container: ReturnType<typeof createContainer>;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        container = createContainer();
        CheckLicensesStepFeature.register(container);
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("passes when all licenses are permissive", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ license: "MIT" })
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([
            { name: "react", version: "19.0.0" },
            { name: "typescript", version: "7.0.2" }
        ]);
        context.results.set("config", {});
        const result = await step.execute(context);

        expect(result.success).toBe(true);
    });

    it("fails when non-permissive license found", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("gpl-package")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ license: "GPL-3.0" })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ license: "MIT" })
            });
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([
            { name: "react", version: "19.0.0" },
            { name: "gpl-package", version: "1.0.0" }
        ]);
        context.results.set("config", {});
        const result = await step.execute(context);

        expect(result.success).toBe(false);
        const violations = context.results.get("violations") as Array<unknown>;
        expect(violations).toHaveLength(1);
    });

    it("classifies unknown license as violation", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({})
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "mystery", version: "1.0.0" }]);
        context.results.set("config", {});
        const result = await step.execute(context);

        expect(result.success).toBe(false);
    });

    it("handles legacy object license format", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ license: { type: "MIT", url: "https://..." } })
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "legacy-pkg", version: "1.0.0" }]);
        context.results.set("config", {});
        const result = await step.execute(context);

        expect(result.success).toBe(true);
    });

    it("handles fetch errors gracefully", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: () => Promise.resolve({})
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "missing-pkg", version: "0.0.0" }]);
        context.results.set("config", {});
        const result = await step.execute(context);

        expect(result.success).toBe(false);
    });

    it("respects allowedRiskTiers from config", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ license: "LGPL-2.1" })
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "lgpl-pkg", version: "1.0.0" }]);
        context.results.set("config", {
            scan: { license: { allowedRiskTiers: ["permissive", "weak-copyleft"] } }
        });
        const result = await step.execute(context);
        expect(result.success).toBe(true);
    });

    it("filters ignored packages from violations", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ license: "GPL-3.0" })
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "gpl-pkg", version: "1.0.0" }]);
        context.results.set("config", {
            scan: { license: { ignoredPackages: ["gpl-pkg"] } }
        });
        const result = await step.execute(context);
        expect(result.success).toBe(true);
    });

    it("filters global ignored packages", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ license: "GPL-3.0" })
        }) as unknown as typeof fetch;

        const step = container.resolve(CheckLicensesStep);
        const context = createTestContext([{ name: "gpl-pkg", version: "1.0.0" }]);
        context.results.set("config", {
            scan: { ignoredPackages: ["gpl-pkg"] }
        });
        const result = await step.execute(context);
        expect(result.success).toBe(true);
    });
});
