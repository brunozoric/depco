import { PrintNextStepsStep as Abstraction } from "./abstractions/PrintNextStepsStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class PrintNextStepsStepImpl implements Abstraction.Interface {
    public name = "print-next-steps";
    public description = "Print next steps";

    public async execute(_context: IStepContext): Promise<IStepResult> {
        console.log("\n✅ Setup complete!\n");
        console.log("Next steps:\n");
        console.log("  depco start             # start the server");
        console.log("  open http://localhost:PORT\n");
        return { success: true };
    }
}

export const PrintNextStepsStep = Abstraction.createImplementation({
    implementation: PrintNextStepsStepImpl,
    dependencies: []
});
