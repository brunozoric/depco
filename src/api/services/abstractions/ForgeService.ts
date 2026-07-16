import { createAbstraction } from "#shared/index.js";

export type ForgeType = "github" | "gitlab" | "unknown";

export interface ICreatePrParams {
    projectPath: string;
    title: string;
    body: string;
    head: string;
    base: string;
}

export interface IPrResult {
    url: string;
    number: number;
}

export interface IParsedRemote {
    owner: string;
    repo: string;
}

export interface IForgeService {
    detectForge(projectPath: string): Promise<ForgeType>;
    createPr(params: ICreatePrParams): Promise<IPrResult>;
    parseRemoteUrl(url: string): IParsedRemote;
}

export const ForgeService = createAbstraction<IForgeService>("Api/ForgeService");

export namespace ForgeService {
    export type Interface = IForgeService;
    export type Type = ForgeType;
    export type CreatePrParams = ICreatePrParams;
    export type PrResult = IPrResult;
    export type ParsedRemote = IParsedRemote;
}
