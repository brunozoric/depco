import { PromptService } from "../../../../services/Prompt/index.js";
import { SelectPortStep as Abstraction } from "./abstractions/SelectPortStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class SelectPortStepImpl implements Abstraction.Interface {
    public name = "select-port";
    public description = "Select server port";

    public constructor(private readonly promptService: PromptService.Interface) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const port = await this.promptService.text({
            message: "Server port:",
            default: "3001",
            validate: value => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num < 1 || num > 65535) {
                    return "Port must be between 1 and 65535";
                }
                return true;
            }
        });
        context.results.set("port", port);
        return { success: true };
    }
}

export const SelectPortStep = Abstraction.createImplementation({
    implementation: SelectPortStepImpl,
    dependencies: [PromptService]
});
