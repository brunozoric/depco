import * as clack from "@clack/prompts";
import { PromptService as Abstraction } from "./abstractions/PromptService.js";

class ClackPromptServiceImpl implements Abstraction.Interface {
    public async text(options: Abstraction.TextOptions): Promise<string> {
        const result = await clack.text({
            message: options.message,
            ...(options.default !== undefined && { defaultValue: options.default }),
            ...(options.validate !== undefined && {
                validate: (value: string | undefined) => {
                    const outcome = options.validate!(value ?? "");
                    return outcome === true ? undefined : outcome;
                }
            })
        });

        if (clack.isCancel(result)) {
            clack.cancel("Operation cancelled.");
            process.exit(130);
        }

        return result;
    }

    public async password(options: Abstraction.PasswordOptions): Promise<string> {
        const result = await clack.password({
            message: options.message,
            ...(options.validate !== undefined && {
                validate: (value: string | undefined) => {
                    const outcome = options.validate!(value ?? "");
                    return outcome === true ? undefined : outcome;
                }
            })
        });

        if (clack.isCancel(result)) {
            clack.cancel("Operation cancelled.");
            process.exit(130);
        }

        return result;
    }
}

export const ClackPromptService = Abstraction.createImplementation({
    implementation: ClackPromptServiceImpl,
    dependencies: []
});
