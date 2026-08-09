import { createAbstraction } from "#shared/index.js";
import type { UserPermission } from "#shared/users/index.js";

export interface IUserRowViewModel {
    id: string;
    email: string;
    displayName: string;
    permission: UserPermission;
    isActive: boolean;
    isSelf: boolean;
}

export interface ICreateUserFormState {
    email: string;
    displayName: string;
    password: string;
    permission: UserPermission;
}

export interface IEditUserFormState {
    id: string;
    displayName: string;
    permission: UserPermission;
}

export interface IUserListViewModel {
    loading: boolean;
    error: string | null;
    mutationError: string | null;
    savingUser: boolean;
    users: IUserRowViewModel[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    search: string;
    sortBy: string;
    sortOrder: string;
    canManage: boolean;
    createModal: ICreateUserFormState | null;
    editModal: IEditUserFormState | null;
    deletingUserId: string | null;
}

export interface IUserListPresenter {
    get vm(): IUserListViewModel;
    load(): Promise<void>;
    setSearch(value: string): void;
    setPage(page: number): void;
    setSortBy(sortBy: string): void;
    openCreateModal(): void;
    openEditModal(id: string): void;
    closeModal(): void;
    setCreateEmail(value: string): void;
    setCreateDisplayName(value: string): void;
    setCreatePassword(value: string): void;
    setCreatePermission(value: UserPermission): void;
    setEditDisplayName(value: string): void;
    setEditPermission(value: UserPermission): void;
    saveCreate(): Promise<void>;
    saveEdit(): Promise<void>;
    confirmDelete(id: string): void;
    cancelDelete(): void;
    deleteUser(): Promise<void>;
    forceLogoutUser(id: string): Promise<void>;
    dispose(): void;
}

export const UserListPresenter = createAbstraction<IUserListPresenter>("Ui/UserListPresenter");

export namespace UserListPresenter {
    export type Interface = IUserListPresenter;
    export type ViewModel = IUserListViewModel;
    export type UserRow = IUserRowViewModel;
    export type CreateFormState = ICreateUserFormState;
    export type EditFormState = IEditUserFormState;
}
