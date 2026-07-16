import { createAbstraction } from "#shared/index.js";

export interface IGitPushResult {
    success: boolean;
    output: string;
}

export interface IGitService {
    getCurrentBranch(projectPath: string): Promise<string>;
    createAndCheckoutBranch(projectPath: string, branchName: string): Promise<void>;
    checkout(projectPath: string, branchName: string): Promise<void>;
    getStatus(projectPath: string): Promise<string[]>;
    stageAll(projectPath: string): Promise<void>;
    commit(projectPath: string, message: string): Promise<string>;
    push(projectPath: string, remoteName: string, branchName: string): Promise<IGitPushResult>;
}

export const GitService = createAbstraction<IGitService>("Api/GitService");

export namespace GitService {
    export type Interface = IGitService;
    export type PushResult = IGitPushResult;
}
