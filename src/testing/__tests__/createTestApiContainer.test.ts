import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "../helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { ScanService } from "#api/services/Scan/index.js";
import { AuthService } from "#api/services/Auth/index.js";

describe("createTestApiContainer", () => {
    it("resolves all major services without explicit registration", () => {
        const { container } = createTestApiContainer();

        expect(() => container.resolve(JobWorker)).not.toThrow();
        expect(() => container.resolve(VulnerabilityService)).not.toThrow();
        expect(() => container.resolve(ScanService)).not.toThrow();
        expect(() => container.resolve(AuthService)).not.toThrow();
    });
});
