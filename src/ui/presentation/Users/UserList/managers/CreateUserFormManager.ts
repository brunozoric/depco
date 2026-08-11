import { makeAutoObservable, runInAction } from "mobx";
import type { UserPermission } from "#shared/users/index.js";
import type { UserListPresenter } from "../abstractions/UserListPresenter.js";
import type { CreateUserUseCase } from "../../useCases/abstractions/CreateUserUseCase.js";
import { getErrorMessage } from "#shared/errors.js";

interface ICreateUserFormManagerDependencies {
    createUserUseCase: CreateUserUseCase.Interface;
    onSaved: () => Promise<void>;
}

export class CreateUserFormManager {
    public formState: UserListPresenter.CreateFormState | null = null;
    public saving = false;
    public error: string | null = null;

    private readonly createUserUseCase: CreateUserUseCase.Interface;
    private readonly onSaved: () => Promise<void>;

    public constructor(dependencies: ICreateUserFormManagerDependencies) {
        this.createUserUseCase = dependencies.createUserUseCase;
        this.onSaved = dependencies.onSaved;
        makeAutoObservable(this);
    }

    public open(): void {
        this.formState = { email: "", displayName: "", password: "", permission: "read-only" };
    }

    public close(): void {
        this.formState = null;
    }

    public setEmail(value: string): void {
        if (this.formState) {
            this.formState.email = value;
        }
    }

    public setDisplayName(value: string): void {
        if (this.formState) {
            this.formState.displayName = value;
        }
    }

    public setPassword(value: string): void {
        if (this.formState) {
            this.formState.password = value;
        }
    }

    public setPermission(value: UserPermission): void {
        if (this.formState) {
            this.formState.permission = value;
        }
    }

    public async save(): Promise<void> {
        const form = this.formState;
        if (!form) {
            return;
        }
        this.error = null;
        this.saving = true;
        try {
            await this.createUserUseCase.execute({
                email: form.email,
                displayName: form.displayName,
                password: form.password,
                permission: form.permission
            });
            await this.onSaved();
            runInAction(() => {
                this.formState = null;
            });
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to create user");
            });
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }
}
