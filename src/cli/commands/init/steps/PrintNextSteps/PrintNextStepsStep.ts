import { Logger } from "@webiny/stdlib";
import { PrintNextStepsStep as Abstraction } from "./abstractions/PrintNextStepsStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class PrintNextStepsStepImpl implements Abstraction.Interface {
    public name = "print-next-steps";
    public description = "Print next steps";

    public constructor(private readonly logger: Logger.Interface) {}

    public async execute(_context: IStepContext): Promise<IStepResult> {
        this.logger.info("\n✅ Setup complete!\n");
        this.logger.info("Next steps:\n");
        this.logger.info("  depco start             # start the server");
        this.logger.info("  open http://localhost:PORT\n");
        return { success: true };
    }
}

export const PrintNextStepsStep = Abstraction.createImplementation({
    implementation: PrintNextStepsStepImpl,
    dependencies: [Logger]
});
