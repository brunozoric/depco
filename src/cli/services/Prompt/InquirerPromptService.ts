import { input, password } from "@inquirer/prompts";
import { PromptService as Abstraction } from "./abstractions/PromptService.js";

class InquirerPromptServiceImpl implements Abstraction.Interface {
    public async text(options: Abstraction.TextOptions): Promise<string> {
        return input({
            message: options.message,
            ...(options.default !== undefined && { default: options.default }),
            ...(options.validate !== undefined && { validate: options.validate })
        });
    }

    public async password(options: Abstraction.PasswordOptions): Promise<string> {
        return password({
            message: options.message,
            ...(options.validate !== undefined && { validate: options.validate })
        });
    }
}

export const InquirerPromptService = Abstraction.createImplementation({
    implementation: InquirerPromptServiceImpl,
    dependencies: []
});
