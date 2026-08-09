import { createAbstraction } from "#shared/index.js";
import type { StepHooksGateway } from "../../../../features/StepHooks/abstractions/StepHooksGateway.js";

export interface IStepHookViewModel {
    id: string;
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
    enabled: boolean;
    sortOrder: number;
    source: "db" | "file" | "package-json";
}

export interface IDiscoveredScriptViewModel {
    name: string;
    command: string;
}

export interface IStepHookFormDefaults {
    name: string;
    command: string;
    type: "package-script";
}

export interface IStepHooksViewModel {
    loading: boolean;
    error: string | null;
    hooks: IStepHookViewModel[];
    formOpen: boolean;
    editingHookId: string | null;
    configSource: "db" | "file";
    discoveredScripts: IDiscoveredScriptViewModel[];
    formDefaults: IStepHookFormDefaults | null;
}

export interface IStepHooksPresenter {
    get vm(): IStepHooksViewModel;
    load: (projectId: string) => Promise<void>;
    create: (input: StepHooksGateway.CreateInput) => Promise<void>;
    update: (hookId: string, input: StepHooksGateway.UpdateInput) => Promise<void>;
    remove: (hookId: string) => Promise<void>;
    toggleEnabled: (hookId: string) => Promise<void>;
    openForm: (hookId?: string) => void;
    openFormWithDefaults: (defaults: IStepHookFormDefaults) => void;
    closeForm: () => void;
}

export const StepHooksPresenter = createAbstraction<IStepHooksPresenter>("Ui/StepHooksPresenter");

export namespace StepHooksPresenter {
    export type Interface = IStepHooksPresenter;
    export type ViewModel = IStepHooksViewModel;
    export type HookViewModel = IStepHookViewModel;
    export type DiscoveredScriptViewModel = IDiscoveredScriptViewModel;
    export type FormDefaults = IStepHookFormDefaults;
}
