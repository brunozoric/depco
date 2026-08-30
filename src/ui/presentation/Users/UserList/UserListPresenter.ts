import { computed, makeAutoObservable, runInAction } from "mobx";
import { DEFAULT_PAGE_SIZES } from "#shared/pagination.js";
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
import { CreateUserFormManager } from "./managers/CreateUserFormManager.js";
import { EditUserFormManager } from "./managers/EditUserFormManager.js";
import { DeleteUserManager } from "./managers/DeleteUserManager.js";
import { getErrorMessage } from "#shared/errors.js";

const FILTER_SCHEMA = listUsersRoute.querystring as NonNullable<typeof listUsersRoute.querystring> &
    z.ZodObject<z.ZodRawShape>;

const DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZES.standard;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER = "desc";
const FULL_PERMISSION: UserPermission = "full";

class UserListPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private mutationError: string | null = null;
    private readonly disposeUrlListener: () => void;

    private readonly createManager: CreateUserFormManager;
    private readonly editManager: EditUserFormManager;
    private readonly deleteManager: DeleteUserManager;

    public constructor(
        private readonly loadUsersUseCase: LoadUsersUseCase.Interface,
        createUserUseCase: CreateUserUseCase.Interface,
        updateUserUseCase: UpdateUserUseCase.Interface,
        deleteUserUseCase: DeleteUserUseCase.Interface,
        private readonly forceLogoutUserUseCase: ForceLogoutUserUseCase.Interface,
        private readonly repository: UsersRepository.Interface,
        private readonly authRepository: AuthRepository.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        const onReload = () => this.load();

        this.createManager = new CreateUserFormManager({
            createUserUseCase,
            onSaved: onReload
        });

        this.editManager = new EditUserFormManager({
            updateUserUseCase,
            repository,
            authRepository,
            onSaved: onReload
        });

        this.deleteManager = new DeleteUserManager({
            deleteUserUseCase,
            onDeleted: onReload
        });

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
            mutationError:
                this.mutationError ??
                this.createManager.error ??
                this.editManager.error ??
                this.deleteManager.error,
            savingUser: this.createManager.saving || this.editManager.saving,
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
            createModal: this.createManager.formState,
            editModal: this.editManager.formState,
            deletingUserId: this.deleteManager.deletingUserId
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
                this.error = getErrorMessage(err, "Failed to load users");
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

    public openCreateModal = (): void => this.createManager.open();
    public openEditModal = (id: string): void => this.editManager.open(id);
    public closeModal = (): void => {
        this.createManager.close();
        this.editManager.close();
    };

    public setCreateEmail = (value: string): void => this.createManager.setEmail(value);
    public setCreateDisplayName = (value: string): void => this.createManager.setDisplayName(value);
    public setCreatePassword = (value: string): void => this.createManager.setPassword(value);
    public setCreatePermission = (value: UserPermission): void =>
        this.createManager.setPermission(value);
    public setEditDisplayName = (value: string): void => this.editManager.setDisplayName(value);
    public setEditPermission = (value: UserPermission): void =>
        this.editManager.setPermission(value);

    public saveCreate = async (): Promise<void> => this.createManager.save();
    public saveEdit = async (): Promise<void> => this.editManager.save();
    public confirmDelete = (id: string): void => this.deleteManager.confirm(id);
    public cancelDelete = (): void => this.deleteManager.cancel();
    public deleteUser = async (): Promise<void> => this.deleteManager.execute();

    public forceLogoutUser = async (id: string): Promise<void> => {
        this.mutationError = null;
        try {
            await this.forceLogoutUserUseCase.execute(id);
        } catch (err) {
            runInAction(() => {
                this.mutationError = getErrorMessage(err, "Failed to force logout user");
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
