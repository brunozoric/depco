import { computed, makeAutoObservable, runInAction } from "mobx";
import type { z } from "zod";
import { UserListPresenter as Abstraction } from "./abstractions/UserListPresenter.js";
import type { UserPermission } from "#shared/users/index.js";
import { listUsersRoute } from "#shared/routes/index.js";
import { LoadUsersUseCase } from "../useCases/abstractions/LoadUsersUseCase.js";
import { CreateUserUseCase } from "../useCases/abstractions/CreateUserUseCase.js";
import { UpdateUserUseCase } from "../useCases/abstractions/UpdateUserUseCase.js";
import { DeleteUserUseCase } from "../useCases/abstractions/DeleteUserUseCase.js";
import { ForceLogoutUserUseCase } from "../useCases/abstractions/ForceLogoutUserUseCase.js";
import { UsersRepository } from "../../../features/Users/abstractions/UsersRepository.js";
import { AuthRepository } from "../../../features/Auth/abstractions/AuthRepository.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";

const FILTER_SCHEMA = listUsersRoute.querystring as NonNullable<typeof listUsersRoute.querystring> &
    z.ZodObject<z.ZodRawShape>;

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER = "desc";
const FULL_PERMISSION: UserPermission = "full";

class UserListPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private mutationError: string | null = null;
    private savingUser = false;
    private createModal: Abstraction.CreateFormState | null = null;
    private editModal: Abstraction.EditFormState | null = null;
    private deletingUserId: string | null = null;
    private readonly disposeUrlListener: () => void;

    public constructor(
        private readonly loadUsersUseCase: LoadUsersUseCase.Interface,
        private readonly createUserUseCase: CreateUserUseCase.Interface,
        private readonly updateUserUseCase: UpdateUserUseCase.Interface,
        private readonly deleteUserUseCase: DeleteUserUseCase.Interface,
        private readonly forceLogoutUserUseCase: ForceLogoutUserUseCase.Interface,
        private readonly repository: UsersRepository.Interface,
        private readonly authRepository: AuthRepository.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            void this.load();
        });
    }

    public get vm(): Abstraction.ViewModel {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const total = this.repository.getTotal();
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const currentUserId = this.authRepository.currentUser?.id ?? null;

        return {
            loading: this.loading,
            error: this.error,
            mutationError: this.mutationError,
            savingUser: this.savingUser,
            users: this.repository.getUsers().map(user => ({
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                permission: user.permission,
                isActive: user.isActive,
                isSelf: user.id === currentUserId
            })),
            total,
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages,
            search: urlFilters.search ?? "",
            sortBy: urlFilters.sortBy ?? DEFAULT_SORT_BY,
            sortOrder: urlFilters.sortOrder ?? DEFAULT_SORT_ORDER,
            canManage: this.authRepository.currentUser?.permission === FULL_PERMISSION,
            createModal: this.createModal,
            editModal: this.editModal,
            deletingUserId: this.deletingUserId
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
            await this.loadUsersUseCase.execute({
                ...(urlFilters.search ? { search: urlFilters.search } : {}),
                page: urlFilters.page ?? 1,
                pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE,
                sortBy: urlFilters.sortBy ?? DEFAULT_SORT_BY,
                sortOrder: urlFilters.sortOrder ?? DEFAULT_SORT_ORDER
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load users";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setSearch = (value: string): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { search: value || null, page: null });
    };

    public setPage = (page: number): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { page: String(page) });
    };

    public setSortBy = (sortBy: string): void => {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const currentSortBy = urlFilters.sortBy ?? DEFAULT_SORT_BY;
        const newSortOrder =
            currentSortBy === sortBy
                ? (urlFilters.sortOrder ?? DEFAULT_SORT_ORDER) === "asc"
                    ? "desc"
                    : "asc"
                : "asc";
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy,
            sortOrder: newSortOrder,
            page: null
        });
    };

    public openCreateModal = (): void => {
        this.createModal = { email: "", displayName: "", password: "", permission: "read-only" };
    };

    public openEditModal = (id: string): void => {
        const user = this.repository.getUsers().find(item => item.id === id);
        if (!user) {
            return;
        }
        this.editModal = {
            id: user.id,
            displayName: user.displayName,
            permission: user.permission
        };
    };

    public closeModal = (): void => {
        this.createModal = null;
        this.editModal = null;
    };

    public setCreateEmail = (value: string): void => {
        if (this.createModal) {
            this.createModal.email = value;
        }
    };

    public setCreateDisplayName = (value: string): void => {
        if (this.createModal) {
            this.createModal.displayName = value;
        }
    };

    public setCreatePassword = (value: string): void => {
        if (this.createModal) {
            this.createModal.password = value;
        }
    };

    public setCreatePermission = (value: UserPermission): void => {
        if (this.createModal) {
            this.createModal.permission = value;
        }
    };

    public setEditDisplayName = (value: string): void => {
        if (this.editModal) {
            this.editModal.displayName = value;
        }
    };

    public setEditPermission = (value: UserPermission): void => {
        if (this.editModal) {
            this.editModal.permission = value;
        }
    };

    public saveCreate = async (): Promise<void> => {
        const form = this.createModal;
        if (!form) {
            return;
        }
        this.mutationError = null;
        this.savingUser = true;
        try {
            await this.createUserUseCase.execute({
                email: form.email,
                displayName: form.displayName,
                password: form.password,
                permission: form.permission
            });
            await this.load();
            runInAction(() => {
                this.createModal = null;
            });
        } catch (err) {
            runInAction(() => {
                this.mutationError = err instanceof Error ? err.message : "Failed to create user";
            });
        } finally {
            runInAction(() => {
                this.savingUser = false;
            });
        }
    };

    public saveEdit = async (): Promise<void> => {
        const form = this.editModal;
        if (!form) {
            return;
        }
        this.mutationError = null;
        this.savingUser = true;
        try {
            const canManage = this.authRepository.currentUser?.permission === FULL_PERMISSION;
            await this.updateUserUseCase.execute(form.id, {
                displayName: form.displayName,
                ...(canManage ? { permission: form.permission } : {})
            });
            await this.load();
            runInAction(() => {
                this.editModal = null;
            });
        } catch (err) {
            runInAction(() => {
                this.mutationError = err instanceof Error ? err.message : "Failed to update user";
            });
        } finally {
            runInAction(() => {
                this.savingUser = false;
            });
        }
    };

    public confirmDelete = (id: string): void => {
        this.deletingUserId = id;
    };

    public cancelDelete = (): void => {
        this.deletingUserId = null;
    };

    public deleteUser = async (): Promise<void> => {
        const id = this.deletingUserId;
        if (!id) {
            return;
        }
        this.mutationError = null;
        try {
            await this.deleteUserUseCase.execute(id);
            await this.load();
        } catch (err) {
            runInAction(() => {
                this.mutationError = err instanceof Error ? err.message : "Failed to delete user";
            });
        } finally {
            runInAction(() => {
                this.deletingUserId = null;
            });
        }
    };

    public forceLogoutUser = async (id: string): Promise<void> => {
        this.mutationError = null;
        try {
            await this.forceLogoutUserUseCase.execute(id);
        } catch (err) {
            runInAction(() => {
                this.mutationError =
                    err instanceof Error ? err.message : "Failed to force logout user";
            });
        }
    };

    public dispose = (): void => {
        this.disposeUrlListener();
    };
}

export const UserListPresenter = Abstraction.createImplementation({
    implementation: UserListPresenterImpl,
    dependencies: [
        LoadUsersUseCase,
        CreateUserUseCase,
        UpdateUserUseCase,
        DeleteUserUseCase,
        ForceLogoutUserUseCase,
        UsersRepository,
        AuthRepository,
        UrlFilterService
    ]
});
