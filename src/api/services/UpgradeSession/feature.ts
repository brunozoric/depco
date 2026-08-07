import { createFeature } from "#shared/index.js";
import { UpgradeSessionService } from "./UpgradeSessionService.js";
import { UpgradeSessionStepResolverRegistry } from "./stepResolvers/StepResolverRegistry.js";
import { SelectPackagesResolver } from "./stepResolvers/SelectPackagesResolver.js";
import { BranchResolver } from "./stepResolvers/BranchResolver.js";
import { UpgradeResolver } from "./stepResolvers/UpgradeResolver.js";
import { RefreshTransientResolver } from "./stepResolvers/RefreshTransientResolver.js";
import { CommitResolver } from "./stepResolvers/CommitResolver.js";
import { PushResolver } from "./stepResolvers/PushResolver.js";
import { PrResolver } from "./stepResolvers/PrResolver.js";

export const UpgradeSessionFeature = createFeature({
    name: "Api/UpgradeSessionFeature",
    register(container) {
        container.register(SelectPackagesResolver);
        container.register(BranchResolver);
        container.register(UpgradeResolver);
        container.register(RefreshTransientResolver);
        container.register(CommitResolver);
        container.register(PushResolver);
        container.register(PrResolver);
        container.register(UpgradeSessionStepResolverRegistry);
        container.register(UpgradeSessionService).inSingletonScope();
    }
});
