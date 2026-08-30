import { createAbstraction } from "#shared/index.js";

export interface ITextPromptOptions {
    message: string;
    default?: string;
    validate?: (value: string) => string | true;
}

export interface IPasswordPromptOptions {
    message: string;
    validate?: (value: string) => string | true;
}

export interface IPromptService {
    text(options: ITextPromptOptions): Promise<string>;
    password(options: IPasswordPromptOptions): Promise<string>;
}

export const PromptService = createAbstraction<IPromptService>("Cli/PromptService");

export namespace PromptService {
    export type Interface = IPromptService;
    export type TextOptions = ITextPromptOptions;
    export type PasswordOptions = IPasswordPromptOptions;
}
