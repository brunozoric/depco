import type { Container } from "@webiny/di";
import type { AnyFeature } from "./createFeature.js";

export function registerFeatures(container: Container, features: AnyFeature[]): void {
    const registeredFeatures = new Set<AnyFeature>();
    const visitingFeatures = new Set<AnyFeature>();

    function visit(feature: AnyFeature): void {
        if (registeredFeatures.has(feature)) {
            return;
        }

        if (visitingFeatures.has(feature)) {
            const cycle = [...visitingFeatures, feature]
                .map(featureInCycle => featureInCycle.name)
                .join(" → ");
            throw new Error(`Feature dependency cycle detected: ${cycle}`);
        }

        visitingFeatures.add(feature);

        for (const dependency of feature.dependencies) {
            visit(dependency);
        }

        visitingFeatures.delete(feature);
        feature.register(container);
        registeredFeatures.add(feature);
    }

    for (const feature of features) {
        visit(feature);
    }
}
