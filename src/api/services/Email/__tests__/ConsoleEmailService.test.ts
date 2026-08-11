import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { EmailService } from "../abstractions/EmailService.js";
import { AppLogService } from "../../AppLog/index.js";

function createMockAppLogService(): AppLogService.Interface {
    return {
        log: vi.fn()
    };
}

describe("ConsoleEmailService", () => {
    it("should log email content via AppLogService", async () => {
        const mockAppLog = createMockAppLogService();
        const { container } = createTestApiContainer();
        container.registerInstance(AppLogService, mockAppLog);

        const emailService = container.resolve(EmailService);

        await emailService.send({
            to: "user@example.com",
            subject: "Test Subject",
            text: "Test body content"
        });

        expect(mockAppLog.log).toHaveBeenCalledWith(
            "info",
            "email",
            null,
            expect.stringContaining("user@example.com")
        );
    });

    it("should never throw", async () => {
        const mockAppLog = createMockAppLogService();
        mockAppLog.log = vi.fn(() => {
            throw new Error("Log failed");
        });
        const { container } = createTestApiContainer();
        container.registerInstance(AppLogService, mockAppLog);

        const emailService = container.resolve(EmailService);

        await expect(
            emailService.send({ to: "x@x.com", subject: "s", text: "t" })
        ).resolves.not.toThrow();
    });
});
