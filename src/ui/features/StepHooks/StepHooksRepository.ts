import { StepHooksRepository as Abstraction } from "./abstractions/StepHooksRepository.js";

class StepHooksRepositoryImpl implements Abstraction.Interface {
    private hooks: Abstraction.StepHook[] = [];
    private configSource: "db" | "file" = "db";
    private discoveredScripts: Abstraction.DiscoveredScript[] = [];

    public getHooks(): Abstraction.StepHook[] {
        return this.hooks;
    }

    public setHooks(hooks: Abstraction.StepHook[]): void {
        this.hooks = hooks;
    }

    public getConfigSource(): "db" | "file" {
        return this.configSource;
    }

    public setConfigSource(source: "db" | "file"): void {
        this.configSource = source;
    }

    public getDiscoveredScripts(): Abstraction.DiscoveredScript[] {
        return this.discoveredScripts;
    }

    public setDiscoveredScripts(scripts: Abstraction.DiscoveredScript[]): void {
        this.discoveredScripts = scripts;
    }
}

export const StepHooksRepository = Abstraction.createImplementation({
    implementation: StepHooksRepositoryImpl,
    dependencies: []
});
