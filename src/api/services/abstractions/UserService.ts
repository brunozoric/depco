import { createAbstraction } from "#shared/index.js";
import type { UserPermission, UserResponse } from "#shared/users/index.js";

export interface IUserCreateParams {
    email: string;
    displayName: string;
    password: string;
    permission: UserPermission;
}

export interface IUserUpdateData {
    displayName?: string;
    password?: string;
    permission?: UserPermission;
    isActive?: boolean;
}

export interface IUserUpdateParams {
    id: string;
    data: IUserUpdateData;
}

export interface IUserListParams {
    search?: string;
    isActive?: boolean;
    page: number;
    pageSize: number;
    sortBy?: "email" | "displayName" | "createdAt";
    sortOrder?: "asc" | "desc";
}

export interface IUserListResult {
    items: UserResponse[];
    total: number;
}

export interface IVerifyPasswordParams {
    userId: string;
    password: string;
}

export interface IUserService {
    create(params: IUserCreateParams): Promise<UserResponse>;
    getById(id: string): Promise<UserResponse | null>;
    getByEmail(email: string): Promise<UserResponse | null>;
    list(params: IUserListParams): Promise<IUserListResult>;
    update(params: IUserUpdateParams): Promise<UserResponse | null>;
    deactivate(id: string): Promise<void>;
    verifyPassword(params: IVerifyPasswordParams): Promise<boolean>;
    hasAnyUsers(): Promise<boolean>;
}

export const UserService = createAbstraction<IUserService>("Api/UserService");

export namespace UserService {
    export type Interface = IUserService;
    export type CreateParams = IUserCreateParams;
    export type UpdateData = IUserUpdateData;
    export type UpdateParams = IUserUpdateParams;
    export type ListParams = IUserListParams;
    export type ListResult = IUserListResult;
    export type VerifyPasswordParams = IVerifyPasswordParams;
}
