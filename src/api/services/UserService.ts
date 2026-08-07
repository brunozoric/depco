import { eq, like, or, and, sql, asc, desc } from "drizzle-orm";
import { hash, verify } from "argon2";
import { generateId } from "@webiny/stdlib";
import { UserService as Abstraction } from "./abstractions/UserService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users } from "#api/db/schema.js";
import type { UserResponse } from "#shared/users/index.js";

class UserServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    private toUserResponse(row: typeof users.$inferSelect): UserResponse {
        return {
            id: row.id,
            email: row.email,
            displayName: row.displayName,
            permission: row.permission as UserResponse["permission"],
            isActive: row.isActive === 1,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }

    public async create(params: Abstraction.CreateParams): Promise<UserResponse> {
        const now = Date.now();
        const passwordHash = await hash(params.password);
        const id = generateId();
        const email = params.email.toLowerCase().trim();

        await this.databaseClient.db
            .insert(users)
            .values({
                id,
                email,
                passwordHash,
                displayName: params.displayName,
                permission: params.permission,
                isActive: 1,
                createdAt: now,
                updatedAt: now
            })
            .run();

        const row = await this.databaseClient.db.select().from(users).where(eq(users.id, id)).get();

        return this.toUserResponse(row!);
    }

    public async getById(id: string): Promise<UserResponse | null> {
        const row = await this.databaseClient.db.select().from(users).where(eq(users.id, id)).get();

        return row ? this.toUserResponse(row) : null;
    }

    public async getByEmail(email: string): Promise<UserResponse | null> {
        const row = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase().trim()))
            .get();

        return row ? this.toUserResponse(row) : null;
    }

    public async list(params: Abstraction.ListParams): Promise<Abstraction.ListResult> {
        const { page, pageSize, sortBy = "createdAt", sortOrder = "desc" } = params;
        const conditions = [];

        if (params.isActive !== undefined) {
            conditions.push(eq(users.isActive, params.isActive ? 1 : 0));
        }

        if (params.search) {
            const pattern = `%${params.search}%`;
            conditions.push(or(like(users.email, pattern), like(users.displayName, pattern))!);
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const orderColumn =
            sortBy === "email"
                ? users.email
                : sortBy === "displayName"
                  ? users.displayName
                  : users.createdAt;
        const orderDirection = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

        const rows = await this.databaseClient.db
            .select()
            .from(users)
            .where(where)
            .orderBy(orderDirection)
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .all();

        const countResult = await this.databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .where(where)
            .get();

        return {
            items: rows.map(row => this.toUserResponse(row)),
            total: countResult?.count ?? 0
        };
    }

    public async update(params: Abstraction.UpdateParams): Promise<UserResponse | null> {
        const updates: Record<string, unknown> = { updatedAt: Date.now() };

        if (params.data.displayName !== undefined) {
            updates["displayName"] = params.data.displayName;
        }
        if (params.data.permission !== undefined) {
            updates["permission"] = params.data.permission;
        }
        if (params.data.isActive !== undefined) {
            updates["isActive"] = params.data.isActive ? 1 : 0;
        }
        if (params.data.password !== undefined) {
            updates["passwordHash"] = await hash(params.data.password);
        }

        await this.databaseClient.db
            .update(users)
            .set(updates)
            .where(eq(users.id, params.id))
            .run();

        return this.getById(params.id);
    }

    public async deactivate(id: string): Promise<void> {
        await this.databaseClient.db
            .update(users)
            .set({ isActive: 0, updatedAt: Date.now() })
            .where(eq(users.id, id))
            .run();
    }

    public async verifyPassword(params: Abstraction.VerifyPasswordParams): Promise<boolean> {
        const row = await this.databaseClient.db
            .select({ passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.id, params.userId))
            .get();

        if (!row) {
            return false;
        }

        return verify(row.passwordHash, params.password);
    }

    public async hasAnyUsers(): Promise<boolean> {
        const result = await this.databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();

        return (result?.count ?? 0) > 0;
    }
}

export const UserService = Abstraction.createImplementation({
    implementation: UserServiceImpl,
    dependencies: [DatabaseClient]
});
