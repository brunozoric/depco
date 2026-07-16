import { createAbstraction } from "#shared/index.js";
import type { IStepResolver } from "./StepResolver.js";

export interface IUpgradeSessionStepResolverRegistry {
    getResolver(type: string, customResolvers?: IStepResolver[]): IStepResolver;
}

export const UpgradeSessionStepResolverRegistry =
    createAbstraction<IUpgradeSessionStepResolverRegistry>(
        "Api/UpgradeSessionStepResolverRegistry"
    );

export namespace UpgradeSessionStepResolverRegistry {
    export type Interface = IUpgradeSessionStepResolverRegistry;
}
