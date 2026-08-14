import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { createFileDestination } from "../createFileDestination.js";

const TEST_LOG_DIR = join(process.cwd(), "testing", "tmp", "logs");

describe("createFileDestination", () => {
    afterEach(() => {
        if (existsSync(TEST_LOG_DIR)) {
            rmSync(TEST_LOG_DIR, { recursive: true });
        }
    });

    it("creates a stream entry that can be written to", async () => {
        mkdirSync(TEST_LOG_DIR, { recursive: true });

        const entry = await createFileDestination({ directory: TEST_LOG_DIR });

        expect(entry.stream).toBeDefined();
        expect(typeof entry.stream.write).toBe("function");
    });
});
