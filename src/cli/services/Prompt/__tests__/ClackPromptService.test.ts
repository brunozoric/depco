import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PromptService } from "../abstractions/PromptService.js";

const mockText = vi.fn();
const mockPassword = vi.fn();
const mockIsCancel = vi.fn();
const mockCancel = vi.fn();
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

vi.mock("@clack/prompts", () => ({
    text: (...args: unknown[]) => mockText(...args),
    password: (...args: unknown[]) => mockPassword(...args),
    isCancel: (...args: unknown[]) => mockIsCancel(...args),
    cancel: (...args: unknown[]) => mockCancel(...args)
}));

describe("ClackPromptService", () => {
    let service: PromptService.Interface;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockIsCancel.mockReturnValue(false);

        const mod = await import("../ClackPromptService.js");
        const { createTestCliContainer } =
            await import("#testing/helpers/createTestCliContainer.js");
        const { PromptService: PromptServiceAbstraction } =
            await import("../abstractions/PromptService.js");
        const container = createTestCliContainer();
        container.register(mod.ClackPromptService);
        service = container.resolve(PromptServiceAbstraction);
    });

    describe("text", () => {
        it("returns the user input", async () => {
            mockText.mockResolvedValue("hello world");

            const result = await service.text({ message: "Enter value:" });

            expect(result).toBe("hello world");
            expect(mockText).toHaveBeenCalledWith(
                expect.objectContaining({ message: "Enter value:" })
            );
        });

        it("passes defaultValue when default is provided", async () => {
            mockText.mockResolvedValue("3001");

            await service.text({ message: "Port:", default: "3001" });

            expect(mockText).toHaveBeenCalledWith(
                expect.objectContaining({ defaultValue: "3001" })
            );
        });

        it("passes validate function when provided", async () => {
            mockText.mockResolvedValue("valid");
            const validate = (value: string): string | true =>
                value.length > 0 ? true : "Required";

            await service.text({ message: "Name:", validate });

            expect(mockText).toHaveBeenCalledWith(
                expect.objectContaining({ validate: expect.any(Function) })
            );
        });

        it("does not pass validate or default when not provided", async () => {
            mockText.mockResolvedValue("value");

            await service.text({ message: "Name:" });

            const callArg = mockText.mock.calls[0]![0] as Record<string, unknown>;
            expect(callArg).not.toHaveProperty("validate");
            expect(callArg).not.toHaveProperty("defaultValue");
        });

        it("exits with code 130 on cancellation", async () => {
            const cancelSymbol = Symbol("cancel");
            mockText.mockResolvedValue(cancelSymbol);
            mockIsCancel.mockReturnValue(true);

            await service.text({ message: "Name:" });

            expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.");
            expect(mockProcessExit).toHaveBeenCalledWith(130);
        });
    });

    describe("password", () => {
        it("returns the user input", async () => {
            mockPassword.mockResolvedValue("secret123");

            const result = await service.password({ message: "Password:" });

            expect(result).toBe("secret123");
            expect(mockPassword).toHaveBeenCalledWith(
                expect.objectContaining({ message: "Password:" })
            );
        });

        it("passes validate function when provided", async () => {
            mockPassword.mockResolvedValue("longpassword");
            const validate = (value: string): string | true =>
                value.length >= 8 ? true : "Too short";

            await service.password({ message: "Password:", validate });

            expect(mockPassword).toHaveBeenCalledWith(
                expect.objectContaining({ validate: expect.any(Function) })
            );
        });

        it("does not pass validate when not provided", async () => {
            mockPassword.mockResolvedValue("value");

            await service.password({ message: "Password:" });

            const callArg = mockPassword.mock.calls[0]![0] as Record<string, unknown>;
            expect(callArg).not.toHaveProperty("validate");
        });

        it("exits with code 130 on cancellation", async () => {
            const cancelSymbol = Symbol("cancel");
            mockPassword.mockResolvedValue(cancelSymbol);
            mockIsCancel.mockReturnValue(true);

            await service.password({ message: "Password:" });

            expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.");
            expect(mockProcessExit).toHaveBeenCalledWith(130);
        });
    });
});
