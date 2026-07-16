import { createAbstraction } from "#shared/index.js";
import { SbomFormatter } from "./SbomFormatter.js";

export interface ISbomFormatterRegistry {
    get(format: string): SbomFormatter.Interface;
}

export const SbomFormatterRegistry = createAbstraction<ISbomFormatterRegistry>(
    "Api/SbomFormatterRegistry"
);

export namespace SbomFormatterRegistry {
    export type Interface = ISbomFormatterRegistry;
    export type Formatter = SbomFormatter.Interface;
}
