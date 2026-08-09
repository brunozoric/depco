import { StepResolver } from "./abstractions/StepResolver.js";
import type { IStepResolver } from "./abstractions/StepResolver.js";
import { UpgradeSessionStepResolverRegistry as Abstraction } from "./abstractions/UpgradeSessionStepResolverRegistry.js";

class UpgradeSessionStepResolverRegistryImpl implements Abstraction.Interface {
    private readonly resolvers = new Map<string, IStepResolver>();

    public constructor(builtInResolvers: StepResolver.Interface[]) {
        for (const resolver of builtInResolvers) {
            this.resolvers.set(resolver.type, resolver);
        }
    }

    public getResolver(type: string, customResolvers?: IStepResolver[]): IStepResolver {
        if (customResolvers) {
            const custom = customResolvers.find(resolver => resolver.type === type);
            if (custom) {
                return custom;
            }
        }

        const resolver = this.resolvers.get(type);
        if (!resolver) {
            throw new Error(`No resolver registered for step type: ${type}`);
        }
        return resolver;
    }
}

export const UpgradeSessionStepResolverRegistry = Abstraction.createImplementation({
    implementation: UpgradeSessionStepResolverRegistryImpl,
    dependencies: [[StepResolver, { multiple: true }]]
});
