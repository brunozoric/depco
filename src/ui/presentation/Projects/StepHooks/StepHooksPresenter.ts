import { computed, makeAutoObservable, runInAction } from "mobx";
import { StepHooksPresenter as Abstraction } from "./abstractions/StepHooksPresenter.js";
import { StepHooksGateway } from "../../../features/StepHooks/abstractions/StepHooksGateway.js";
import { StepHooksRepository } from "../../../features/StepHooks/abstractions/StepHooksRepository.js";

class StepHooksPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private formOpen = false;
    private editingHookId: string | null = null;
    private formDefaults: Abstraction.FormDefaults | null = null;
    private projectId: string | null = null;

    public constructor(
        private readonly stepHooksGateway: StepHooksGateway.Interface,
        private readonly stepHooksRepository: StepHooksRepository.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        const hooks: Abstraction.HookViewModel[] = this.stepHooksRepository
            .getHooks()
            .map(hook => ({
                id: hook.id,
                position: hook.position,
                name: hook.name,
                command: hook.command,
                type: hook.type,
                required: hook.required,
                enabled: hook.enabled,
                sortOrder: hook.sortOrder,
                source: hook.source
            }));

        return {
            loading: this.loading,
            error: this.error,
            hooks,
            formOpen: this.formOpen,
            editingHookId: this.editingHookId,
            configSource: this.stepHooksRepository.getConfigSource(),
            discoveredScripts: this.stepHooksRepository.getDiscoveredScripts().map(script => ({
                name: script.name,
                command: script.command
            })),
            formDefaults: this.formDefaults
        };
    }

    public load = async (projectId: string): Promise<void> => {
        this.projectId = projectId;
        this.loading = true;
        this.error = null;
        try {
            const result = await this.stepHooksGateway.list(projectId);
            runInAction(() => {
                this.stepHooksRepository.setHooks(result.hooks);
                this.stepHooksRepository.setConfigSource(result.configSource);
                this.stepHooksRepository.setDiscoveredScripts(result.discoveredScripts);
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load step hooks";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public create = async (input: StepHooksGateway.CreateInput): Promise<void> => {
        if (!this.projectId) {
            return;
        }
        this.error = null;
        try {
            await this.stepHooksGateway.create(this.projectId, input);
            await this.load(this.projectId);
            runInAction(() => {
                this.closeForm();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to create step hook";
            });
        }
    };

    public update = async (hookId: string, input: StepHooksGateway.UpdateInput): Promise<void> => {
        if (!this.projectId) {
            return;
        }
        this.error = null;
        try {
            await this.stepHooksGateway.update(this.projectId, hookId, input);
            await this.load(this.projectId);
            runInAction(() => {
                this.closeForm();
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to update step hook";
            });
        }
    };

    public remove = async (hookId: string): Promise<void> => {
        if (!this.projectId) {
            return;
        }
        this.error = null;
        try {
            await this.stepHooksGateway.remove(this.projectId, hookId);
            await this.load(this.projectId);
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to remove step hook";
            });
        }
    };

    public toggleEnabled = async (hookId: string): Promise<void> => {
        const current = this.stepHooksRepository.getHooks().find(hook => hook.id === hookId);
        if (!current) {
            return;
        }
        await this.update(hookId, { enabled: !current.enabled });
    };

    public openForm = (hookId?: string): void => {
        this.formOpen = true;
        this.editingHookId = hookId ?? null;
        this.formDefaults = null;
    };

    public openFormWithDefaults = (defaults: Abstraction.FormDefaults): void => {
        this.formOpen = true;
        this.editingHookId = null;
        this.formDefaults = defaults;
    };

    public closeForm = (): void => {
        this.formOpen = false;
        this.editingHookId = null;
        this.formDefaults = null;
    };
}

export const StepHooksPresenter = Abstraction.createImplementation({
    implementation: StepHooksPresenterImpl,
    dependencies: [StepHooksGateway, StepHooksRepository]
});
