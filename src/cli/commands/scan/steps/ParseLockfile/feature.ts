import { createFeature } from "#shared/index.js";
import { LockfileParserService as LockfileParserServiceImpl } from "#api/services/DependencyGraph/LockfileParserService.js";
import { ParseLockfileStep } from "./ParseLockfileStep.js";

export const ParseLockfileStepFeature = createFeature({
    name: "Cli/ParseLockfileStep",
    register(container) {
        container.register(LockfileParserServiceImpl).inSingletonScope();
        container.register(ParseLockfileStep).inSingletonScope();
    }
});
