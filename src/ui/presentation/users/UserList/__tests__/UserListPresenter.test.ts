// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersGateway as UsersGatewayAbstraction } from "../../../../features/users/abstractions/UsersGateway.js";
import type { UsersGateway } from "../../../../features/users/abstractions/UsersGateway.js";
import { UsersRepository as UsersRepositoryRegistration } from "../../../../features/users/UsersRepository.js";
import { AuthRepository as AuthRepositoryAbstraction } from "../../../../features/auth/abstractions/AuthRepository.js";
import type { AuthRepository } from "../../../../features/auth/abstractions/AuthRepository.js";
import { LoadUsersUseCase as LoadUsersUseCaseRegistration } from "../../useCases/LoadUsersUseCase.js";
import { CreateUserUseCase as CreateUserUseCaseRegistration } from "../../useCases/CreateUserUseCase.js";
import { UpdateUserUseCase as UpdateUserUseCaseRegistration } from "../../useCases/UpdateUserUseCase.js";
import { DeleteUserUseCase as DeleteUserUseCaseRegistration } from "../../useCases/DeleteUserUseCase.js";
import { ForceLogoutUserUseCase as ForceLogoutUserUseCaseRegistration } from "../../useCases/ForceLogoutUserUseCase.js";
import { UrlFilterFeature } from "../../../../features/urlFilter/feature.js";
import { UserListPresenter } from "../abstractions/UserListPresenter.js";
import { UserListPresenter as UserListPresenterRegistration } from "../UserListPresenter.js";
import type { UserResponse } from "#shared/users/index.js";

function setUrlParams(params: Record<string, string>): void {
    const search = new URLSearchParams(params).toString();
    Object.defineProperty(window, "location", {
        writable: true,
        value: { ...window.location, search: search ? `?${search}` : "", pathname: "/users" }
    });
}

function user(overrides: Partial<UserResponse> = {}): UserResponse {
    return {
        id: "user-1",
        email: "jane@example.com",
        displayName: "Jane Doe",
        permission: "read-only",
        isActive: true,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides
    };
}

interface RecordedGatewayCall {
    method: string;
    args: unknown;
}

interface MockGatewayState {
    users: UsersGateway.User[];
    failList: boolean;
    failCreate: boolean;
    failUpdate: boolean;
    failRemove: boolean;
    failForceLogout: boolean;
}

interface MockGatewayHandle {
    gateway: UsersGateway.Interface;
    state: MockGatewayState;
    calls: RecordedGatewayCall[];
}

function createMockGateway(initial?: Partial<MockGatewayState>): MockGatewayHandle {
    const state: MockGatewayState = {
        users: initial?.users ?? [],
        failList: initial?.failList ?? false,
        failCreate: initial?.failCreate ?? false,
        failUpdate: initial?.failUpdate ?? false,
        failRemove: initial?.failRemove ?? false,
        failForceLogout: initial?.failForceLogout ?? false
    };
    const calls: RecordedGatewayCall[] = [];

    const gateway: UsersGateway.Interface = {
        list: async query => {
            calls.push({ method: "list", args: query });
            if (state.failList) {
                throw new Error("Failed to load users");
            }
            return { items: state.users, total: state.users.length };
        },
        getById: async id => {
            const found = state.users.find(item => item.id === id);
            if (!found) {
                throw new Error(`Unknown user ${id}`);
            }
            return found;
        },
        create: async input => {
            calls.push({ method: "create", args: input });
            if (state.failCreate) {
                throw new Error("Failed to create user");
            }
            const created = user({
                id: `user-${state.users.length + 1}`,
                email: input.email,
                displayName: input.displayName,
                permission: input.permission
            });
            state.users = [...state.users, created];
            return created;
        },
        update: async (id, input) => {
            calls.push({ method: "update", args: { id, input } });
            if (state.failUpdate) {
                throw new Error("Failed to update user");
            }
            state.users = state.users.map(item => (item.id === id ? { ...item, ...input } : item));
            const updated = state.users.find(item => item.id === id);
            if (!updated) {
                throw new Error(`Unknown user ${id}`);
            }
            return updated;
        },
        remove: async id => {
            calls.push({ method: "remove", args: id });
            if (state.failRemove) {
                throw new Error("Failed to delete user");
            }
            state.users = state.users.filter(item => item.id !== id);
        },
        forceLogout: async id => {
            calls.push({ method: "forceLogout", args: id });
            if (state.failForceLogout) {
                throw new Error("Failed to force logout user");
            }
        }
    };

    return { gateway, state, calls };
}

function createAuthRepository(initialUser: UserResponse | null): AuthRepository.Interface {
    let currentUserValue = initialUser;
    return {
        get token() {
            return "test-token";
        },
        get currentUser() {
            return currentUserValue;
        },
        get isAuthenticated() {
            return currentUserValue !== null;
        },
        setAuth: input => {
            currentUserValue = input.user;
        },
        clearAuth: () => {
            currentUserValue = null;
        }
    };
}

describe("UserListPresenter", () => {
    function createPresenter(
        mockGateway: MockGatewayHandle,
        currentUser: UserResponse | null = user({ id: "self", permission: "full" })
    ): UserListPresenter.Interface {
        const container = createContainer();

        container.registerInstance(UsersGatewayAbstraction, mockGateway.gateway);
        container.register(UsersRepositoryRegistration).inSingletonScope();
        container.registerInstance(AuthRepositoryAbstraction, createAuthRepository(currentUser));
        UrlFilterFeature.register(container);
        container.register(LoadUsersUseCaseRegistration);
        container.register(CreateUserUseCaseRegistration);
        container.register(UpdateUserUseCaseRegistration);
        container.register(DeleteUserUseCaseRegistration);
        container.register(ForceLogoutUserUseCaseRegistration);
        container.register(UserListPresenterRegistration);

        return container.resolve(UserListPresenter);
    }

    let mockGateway: MockGatewayHandle;

    beforeEach(() => {
        setUrlParams({});
        mockGateway = createMockGateway();
    });

    describe("initial state", () => {
        it("starts with loading true and empty collections before load resolves", () => {
            const presenter = createPresenter(mockGateway);

            expect(presenter.vm.loading).toBe(true);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.users).toEqual([]);
            expect(presenter.vm.createModal).toBeNull();
            expect(presenter.vm.editModal).toBeNull();
            expect(presenter.vm.deletingUserId).toBeNull();
        });
    });

    describe("load", () => {
        it("populates users and marks the acting user's own row", async () => {
            mockGateway.state.users = [
                user({ id: "self", email: "me@example.com", permission: "full" }),
                user({ id: "user-2", email: "other@example.com" })
            ];
            const presenter = createPresenter(
                mockGateway,
                user({ id: "self", permission: "full" })
            );

            await presenter.load();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.users.map(item => ({ id: item.id, isSelf: item.isSelf }))).toEqual([
                { id: "self", isSelf: true },
                { id: "user-2", isSelf: false }
            ]);
        });

        it("sets an error message when the gateway rejects", async () => {
            mockGateway.state.failList = true;
            const presenter = createPresenter(mockGateway);

            await presenter.load();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBe("Failed to load users");
        });
    });

    describe("permission gating", () => {
        it("canManage is true for a full-permission user", () => {
            const presenter = createPresenter(mockGateway, user({ permission: "full" }));
            expect(presenter.vm.canManage).toBe(true);
        });

        it("canManage is false for a read-only user", () => {
            const presenter = createPresenter(mockGateway, user({ permission: "read-only" }));
            expect(presenter.vm.canManage).toBe(false);
        });
    });

    describe("create modal", () => {
        it("openCreateModal starts an empty form and closeModal clears it", () => {
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            expect(presenter.vm.createModal).toEqual({
                email: "",
                displayName: "",
                password: "",
                permission: "read-only"
            });

            presenter.closeModal();
            expect(presenter.vm.createModal).toBeNull();
        });

        it("saveCreate creates the user and refreshes the list", async () => {
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setCreateEmail("new@example.com");
            presenter.setCreateDisplayName("New User");
            presenter.setCreatePassword("supersecret");
            presenter.setCreatePermission("full");
            await presenter.saveCreate();

            expect(mockGateway.calls.some(call => call.method === "create")).toBe(true);
            expect(presenter.vm.createModal).toBeNull();
            expect(presenter.vm.users.some(item => item.email === "new@example.com")).toBe(true);
        });

        it("keeps the modal open and sets a mutation error when create fails", async () => {
            mockGateway.state.failCreate = true;
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setCreateEmail("new@example.com");
            await presenter.saveCreate();

            expect(presenter.vm.mutationError).toBe("Failed to create user");
            expect(presenter.vm.createModal).not.toBeNull();
        });
    });

    describe("edit modal", () => {
        it("openEditModal seeds the form from the target user", async () => {
            mockGateway.state.users = [user({ id: "user-2", displayName: "Other User" })];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.openEditModal("user-2");

            expect(presenter.vm.editModal).toEqual({
                id: "user-2",
                displayName: "Other User",
                permission: "read-only"
            });
        });

        it("saveEdit updates the user and refreshes the list", async () => {
            mockGateway.state.users = [user({ id: "user-2", displayName: "Other User" })];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.openEditModal("user-2");
            presenter.setEditDisplayName("Renamed");
            await presenter.saveEdit();

            expect(presenter.vm.editModal).toBeNull();
            expect(presenter.vm.users.find(item => item.id === "user-2")?.displayName).toBe(
                "Renamed"
            );
        });

        it("omits the permission field when the acting user is read-only", async () => {
            mockGateway.state.users = [user({ id: "user-2", displayName: "Other User" })];
            const presenter = createPresenter(mockGateway, user({ permission: "read-only" }));
            await presenter.load();

            presenter.openEditModal("user-2");
            presenter.setEditDisplayName("Renamed");
            await presenter.saveEdit();

            const updateCall = mockGateway.calls.find(call => call.method === "update");
            expect(updateCall).toEqual({
                method: "update",
                args: { id: "user-2", input: { displayName: "Renamed" } }
            });
        });
    });

    describe("delete", () => {
        it("confirmDelete sets the pending id and cancelDelete clears it", () => {
            const presenter = createPresenter(mockGateway);

            presenter.confirmDelete("user-2");
            expect(presenter.vm.deletingUserId).toBe("user-2");

            presenter.cancelDelete();
            expect(presenter.vm.deletingUserId).toBeNull();
        });

        it("deleteUser removes the user and refreshes the list", async () => {
            mockGateway.state.users = [
                user({ id: "user-1", email: "a@example.com" }),
                user({ id: "user-2", email: "b@example.com" })
            ];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.confirmDelete("user-2");
            await presenter.deleteUser();

            expect(presenter.vm.deletingUserId).toBeNull();
            expect(presenter.vm.users.map(item => item.id)).toEqual(["user-1"]);
        });

        it("sets a mutation error when delete fails", async () => {
            mockGateway.state.users = [user({ id: "user-2" })];
            mockGateway.state.failRemove = true;
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.confirmDelete("user-2");
            await presenter.deleteUser();

            expect(presenter.vm.mutationError).toBe("Failed to delete user");
            expect(presenter.vm.deletingUserId).toBeNull();
        });
    });

    describe("forceLogoutUser", () => {
        it("calls the gateway with the target id", async () => {
            const presenter = createPresenter(mockGateway);

            await presenter.forceLogoutUser("user-2");

            expect(mockGateway.calls).toEqual([{ method: "forceLogout", args: "user-2" }]);
        });

        it("sets a mutation error when the call fails", async () => {
            mockGateway.state.failForceLogout = true;
            const presenter = createPresenter(mockGateway);

            await presenter.forceLogoutUser("user-2");

            expect(presenter.vm.mutationError).toBe("Failed to force logout user");
        });
    });
});
