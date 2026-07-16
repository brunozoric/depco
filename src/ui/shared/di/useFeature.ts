import { useMemo } from "react";
import type { Container } from "@webiny/di";
import { useContainer } from "./ContainerProvider.js";

interface FeatureWithResolve<TExports> {
    resolve(container: Container): TExports;
}

export function useFeature<TExports>(feature: FeatureWithResolve<TExports>): TExports {
    const container = useContainer();
    return useMemo(() => feature.resolve(container), [container, feature]);
}
