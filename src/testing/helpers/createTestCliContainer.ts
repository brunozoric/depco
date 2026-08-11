import type { Container } from "@webiny/di";
import { createContainer, registerFeatures } from "#shared/index.js";
import { CliFeature } from "../../cli/feature.js";

export function createTestCliContainer(): Container {
    const container = createContainer();
    registerFeatures(container, [CliFeature]);
    return container;
}
