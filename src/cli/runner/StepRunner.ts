import { StepRunner as Abstraction } from "./abstractions/StepRunner.js";
import type { IStep, IStepContext } from "./abstractions/Step.js";

class StepRunnerImpl implements Abstraction.Interface {
    public async run(args: Abstraction.Args): Promise<void> {
        const { steps, context } = args;
        const completed: IStep[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const label = `[${i + 1}/${steps.length}] ${step.description}`;

            try {
                const result = await step.execute(context);

                if (result.skipped) {
                    console.log(
                        `\x1b[33m⊘ ${label} — skipped${result.message ? `: ${result.message}` : ""}\x1b[0m`
                    );
                    continue;
                }

                if (!result.success) {
                    console.log(
                        `\x1b[31m✗ ${label}${result.message ? `: ${result.message}` : ""}\x1b[0m`
                    );
                    await this.rollback(completed, context);
                    throw new Error(
                        `Step "${step.name}" failed${result.message ? `: ${result.message}` : ""}`
                    );
                }

                console.log(`\x1b[32m✓ ${label}\x1b[0m`);
                completed.push(step);
            } catch (error) {
                if (error instanceof Error && error.message.startsWith('Step "')) {
                    throw error;
                }
                console.log(`\x1b[31m✗ ${label}\x1b[0m`);
                await this.rollback(completed, context);
                throw new Error(
                    `Step "${step.name}" threw: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }

    private async rollback(completed: IStep[], context: IStepContext): Promise<void> {
        for (let i = completed.length - 1; i >= 0; i--) {
            const step = completed[i]!;
            if (step.rollback) {
                try {
                    await step.rollback(context);
                    console.log(`\x1b[33m↩ Rolled back: ${step.name}\x1b[0m`);
                } catch (rollbackError) {
                    console.error(
                        `\x1b[31m↩ Rollback failed for ${step.name}: ${rollbackError}\x1b[0m`
                    );
                }
            }
        }
    }
}

export const StepRunner = Abstraction.createImplementation({
    implementation: StepRunnerImpl,
    dependencies: []
});
