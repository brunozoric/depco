import type React from "react";
import { useCurrentPath } from "./router.js";
import { useContainer } from "../Shared/di/ContainerProvider.js";
import { RouteRegistry } from "./abstractions/RouteRegistry.js";

export function RouterComponent(): React.ReactNode {
    const path = useCurrentPath();
    const container = useContainer();
    const registry = container.resolve(RouteRegistry);
    const query = new URLSearchParams(window.location.search);
    const result = registry.resolve({ path, query });

    if (result) {
        return result.route.render(result.match);
    }

    return null;
}
