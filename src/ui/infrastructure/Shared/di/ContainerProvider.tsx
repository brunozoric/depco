import type React from "react";
import { createContext, useContext, useMemo } from "react";
import type { Container } from "@webiny/di";
import { createContainer, registerFeatures } from "#shared/index.js";
import type { AnyFeature } from "#shared/index.js";

const ContainerContext = createContext<Container | null>(null);

interface ContainerProviderProps {
    features: AnyFeature[];
    children: React.ReactNode;
}

export function ContainerProvider({ features, children }: ContainerProviderProps): React.ReactNode {
    const container = useMemo(() => {
        const container = createContainer();
        registerFeatures(container, features);
        return container;
    }, [features]);

    return <ContainerContext value={container}>{children}</ContainerContext>;
}

export function useContainer(): Container {
    const container = useContext(ContainerContext);
    if (!container) {
        throw new Error("useContainer must be used within a ContainerProvider");
    }
    return container;
}
