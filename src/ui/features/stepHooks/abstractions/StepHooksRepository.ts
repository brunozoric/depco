import { createAbstraction } from "#shared/index.js";
import { StepHooksGateway } from "./StepHooksGateway.js";

export interface IStepHooksRepository {
    getHooks(): StepHooksGateway.StepHook[];
    setHooks(hooks: StepHooksGateway.StepHook[]): void;
    getConfigSource(): "db" | "file";
    setConfigSource(source: "db" | "file"): void;
    getDiscoveredScripts(): StepHooksGateway.DiscoveredScript[];
    setDiscoveredScripts(scripts: StepHooksGateway.DiscoveredScript[]): void;
}

export const StepHooksRepository =
    createAbstraction<IStepHooksRepository>("Ui/StepHooksRepository");

export namespace StepHooksRepository {
    export type Interface = IStepHooksRepository;
    export type StepHook = StepHooksGateway.StepHook;
    export type DiscoveredScript = StepHooksGateway.DiscoveredScript;
}
