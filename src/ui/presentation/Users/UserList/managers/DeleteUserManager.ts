import { makeAutoObservable, runInAction } from "mobx";
import type { DeleteUserUseCase } from "../../useCases/abstractions/DeleteUserUseCase.js";
import { getErrorMessage } from "#shared/errors.js";

interface IDeleteUserManagerDependencies {
    deleteUserUseCase: DeleteUserUseCase.Interface;
    onDeleted: () => Promise<void>;
}

export class DeleteUserManager {
    public deletingUserId: string | null = null;
    public error: string | null = null;

    private readonly deleteUserUseCase: DeleteUserUseCase.Interface;
    private readonly onDeleted: () => Promise<void>;

    public constructor(dependencies: IDeleteUserManagerDependencies) {
        this.deleteUserUseCase = dependencies.deleteUserUseCase;
        this.onDeleted = dependencies.onDeleted;
        makeAutoObservable(this);
    }

    public confirm(id: string): void {
        this.deletingUserId = id;
    }

    public cancel(): void {
        this.deletingUserId = null;
    }

    public async execute(): Promise<void> {
        const id = this.deletingUserId;
        if (!id) {
            return;
        }
        this.error = null;
        try {
            await this.deleteUserUseCase.execute(id);
            await this.onDeleted();
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to delete user");
            });
        } finally {
            runInAction(() => {
                this.deletingUserId = null;
            });
        }
    }
}
