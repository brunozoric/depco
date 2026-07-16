import { createAbstraction } from "#shared/index.js";

export interface IStepHook {
    id: string;
    projectId: string;
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
    enabled: boolean;
    sortOrder: number;
    source: "db" | "file" | "package-json";
    createdAt: number;
    updatedAt: number;
}

export interface ICreateStepHookInput {
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
}

export interface IUpdateStepHookInput {
    name?: string;
    command?: string;
    type?: "command" | "script" | "package-script";
    required?: boolean;
    enabled?: boolean;
    sortOrder?: number;
}

export interface IDiscoveredScript {
    name: string;
    command: string;
}

export interface IStepHooksListResult {
    hooks: IStepHook[];
    configSource: "db" | "file";
    discoveredScripts: IDiscoveredScript[];
}

export interface IStepHooksGateway {
    list(projectId: string): Promise<IStepHooksListResult>;
    create(projectId: string, input: ICreateStepHookInput): Promise<IStepHook>;
    update(projectId: string, hookId: string, input: IUpdateStepHookInput): Promise<IStepHook>;
    remove(projectId: string, hookId: string): Promise<void>;
}

export const StepHooksGateway = createAbstraction<IStepHooksGateway>("Ui/StepHooksGateway");

export namespace StepHooksGateway {
    export type Interface = IStepHooksGateway;
    export type StepHook = IStepHook;
    export type CreateInput = ICreateStepHookInput;
    export type UpdateInput = IUpdateStepHookInput;
    export type ListResult = IStepHooksListResult;
    export type DiscoveredScript = IDiscoveredScript;
}
