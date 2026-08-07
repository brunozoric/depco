import { createAbstraction } from "#shared/index.js";
import type { UserResponse, UserPermission } from "#shared/users/index.js";

export interface IUsersListQuery {
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: "email" | "displayName" | "createdAt";
    sortOrder?: "asc" | "desc";
}

export interface IUsersListResponse {
    items: UserResponse[];
    total: number;
}

export interface ICreateUserInput {
    email: string;
    displayName: string;
    password: string;
    permission: UserPermission;
}

export interface IUpdateUserInput {
    displayName?: string;
    password?: string;
    permission?: UserPermission;
    isActive?: boolean;
}

export interface IUsersGateway {
    list(query?: IUsersListQuery): Promise<IUsersListResponse>;
    getById(id: string): Promise<UserResponse>;
    create(body: ICreateUserInput): Promise<UserResponse>;
    update(id: string, body: IUpdateUserInput): Promise<UserResponse>;
    remove(id: string): Promise<void>;
    forceLogout(id: string): Promise<void>;
}

export const UsersGateway = createAbstraction<IUsersGateway>("Ui/UsersGateway");

export namespace UsersGateway {
    export type Interface = IUsersGateway;
    export type ListQuery = IUsersListQuery;
    export type ListResponse = IUsersListResponse;
    export type CreateInput = ICreateUserInput;
    export type UpdateInput = IUpdateUserInput;
    export type User = UserResponse;
    export type Permission = UserPermission;
}
