import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { EmailService } from "../abstractions/EmailService.js";
import { ConsoleEmailService } from "../ConsoleEmailService.js";
import { AppLogService } from "../../abstractions/AppLogService.js";

function createMockAppLogService(): AppLogService.Interface {
    return {
        log: vi.fn()
    };
}

describe("ConsoleEmailService", () => {
    it("should log email content via AppLogService", async () => {
        const mockAppLog = createMockAppLogService();
        const container = createContainer();
        container.registerInstance(AppLogService, mockAppLog);
        container.register(ConsoleEmailService).inSingletonScope();

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
        const container = createContainer();
        container.registerInstance(AppLogService, mockAppLog);
        container.register(ConsoleEmailService).inSingletonScope();

        const emailService = container.resolve(EmailService);

        await expect(
            emailService.send({ to: "x@x.com", subject: "s", text: "t" })
        ).resolves.not.toThrow();
    });
});
