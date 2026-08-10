import { createAbstraction } from "#shared/index.js";
import type { IOutputFormatter } from "../types.js";

export interface IOutputFormatterFactoryInput {
    format: string;
}

export interface IOutputFormatterFactory {
    create(input: IOutputFormatterFactoryInput): IOutputFormatter;
}

export const OutputFormatterFactory = createAbstraction<IOutputFormatterFactory>(
    "Cli/OutputFormatterFactory"
);

export namespace OutputFormatterFactory {
    export type Interface = IOutputFormatterFactory;
    export type Input = IOutputFormatterFactoryInput;
}
