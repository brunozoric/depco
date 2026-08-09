import { StartServerStep as Abstraction } from "./abstractions/StartServerStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class StartServerStepImpl implements Abstraction.Interface {
    public name = "start-server";
    public description = "Start the depco server";

    public async execute(_context: IStepContext): Promise<IStepResult> {
        const { startServer } = await import("#api/server.js");
        await startServer();
        return { success: true };
    }
}

export const StartServerStep = Abstraction.createImplementation({
    implementation: StartServerStepImpl,
    dependencies: []
});
