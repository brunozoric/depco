import { hash } from "argon2";
import { generateId, Logger } from "@webiny/stdlib";
import { sql } from "drizzle-orm";
import { CreateAdminUserStep as Abstraction } from "./abstractions/CreateAdminUserStep.js";
import { PromptService } from "../../../../services/Prompt/index.js";
import { createDatabaseClient } from "#api/db/client.js";
import { users } from "#api/db/schema.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class CreateAdminUserStepImpl implements Abstraction.Interface {
    public name = "create-admin-user";
    public description = "Create admin user";

    public constructor(
        private readonly logger: Logger.Interface,
        private readonly promptService: PromptService.Interface
    ) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const dbPath = context.results.get("dbPath") as string;
        const databaseClient = createDatabaseClient(dbPath);

        const countResult = databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();

        if (countResult && countResult.count > 0) {
            return { success: true, skipped: true, message: "users already exist" };
        }

        this.logger.info("\nCreate the first admin user:\n");

        const email = await this.promptService.text({
            message: "Email:",
            validate: value => {
                if (!value.includes("@")) {
                    return "Please enter a valid email address";
                }
                return true;
            }
        });

        const displayName = await this.promptService.text({
            message: "Display name:",
            validate: value => {
                if (value.length < 1) {
                    return "Display name is required";
                }
                return true;
            }
        });

        const userPassword = await this.promptService.password({
            message: "Password (min 8 chars):",
            validate: value => {
                if (value.length < 8) {
                    return "Password must be at least 8 characters";
                }
                return true;
            }
        });

        const confirmPassword = await this.promptService.password({
            message: "Confirm password:"
        });

        if (userPassword !== confirmPassword) {
            return { success: false, message: "Passwords do not match" };
        }

        const passwordHash = await hash(userPassword);
        const now = Date.now();

        databaseClient.db
            .insert(users)
            .values({
                id: generateId(),
                email: email.toLowerCase().trim(),
                passwordHash,
                displayName,
                permission: "full",
                isActive: 1,
                createdAt: now,
                updatedAt: now
            })
            .run();

        return { success: true, message: `Admin user created: ${email}` };
    }
}

export const CreateAdminUserStep = Abstraction.createImplementation({
    implementation: CreateAdminUserStepImpl,
    dependencies: [Logger, PromptService]
});
