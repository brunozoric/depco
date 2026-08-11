import { makeAutoObservable, runInAction } from "mobx";
import type { UserPermission } from "#shared/users/index.js";
import type { UserListPresenter } from "../abstractions/UserListPresenter.js";
import type { UpdateUserUseCase } from "../../useCases/abstractions/UpdateUserUseCase.js";
import type { UsersRepository } from "../../../../features/Users/abstractions/UsersRepository.js";
import type { AuthRepository } from "../../../../features/Auth/abstractions/AuthRepository.js";
import { getErrorMessage } from "#shared/errors.js";

interface IEditUserFormManagerDependencies {
    updateUserUseCase: UpdateUserUseCase.Interface;
    repository: UsersRepository.Interface;
    authRepository: AuthRepository.Interface;
    onSaved: () => Promise<void>;
}

export class EditUserFormManager {
    public formState: UserListPresenter.EditFormState | null = null;
    public saving = false;
    public error: string | null = null;

    private readonly updateUserUseCase: UpdateUserUseCase.Interface;
    private readonly repository: UsersRepository.Interface;
    private readonly authRepository: AuthRepository.Interface;
    private readonly onSaved: () => Promise<void>;

    public constructor(dependencies: IEditUserFormManagerDependencies) {
        this.updateUserUseCase = dependencies.updateUserUseCase;
        this.repository = dependencies.repository;
        this.authRepository = dependencies.authRepository;
        this.onSaved = dependencies.onSaved;
        makeAutoObservable(this);
    }

    public open(id: string): void {
        const user = this.repository.getUsers().find(item => item.id === id);
        if (!user) {
            return;
        }
        this.formState = {
            id: user.id,
            displayName: user.displayName,
            permission: user.permission
        };
    }

    public close(): void {
        this.formState = null;
    }

    public setDisplayName(value: string): void {
        if (this.formState) {
            this.formState.displayName = value;
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
            const canManage = this.authRepository.currentUser?.permission === "full";
            await this.updateUserUseCase.execute(form.id, {
                displayName: form.displayName,
                ...(canManage ? { permission: form.permission } : {})
            });
            await this.onSaved();
            runInAction(() => {
                this.formState = null;
            });
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to update user");
            });
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }
}
