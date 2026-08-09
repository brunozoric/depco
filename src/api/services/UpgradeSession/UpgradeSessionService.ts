import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { UpgradeSessionService as Abstraction } from "./abstractions/UpgradeSessionService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { upgradeSessions, projects } from "#api/db/schema.js";
import { getNextStep } from "./stepResolvers/abstractions/StepResolver.js";
import type { IStepResolver } from "./stepResolvers/abstractions/StepResolver.js";
import { UpgradeSessionStepResolverRegistry } from "./stepResolvers/abstractions/UpgradeSessionStepResolverRegistry.js";
import type { ICustomStepConfig } from "./stepResolvers/abstractions/CustomStepConfig.js";
import { CustomStepResolver } from "./stepResolvers/CustomStepResolver.js";
import { buildStepOrder, createSessionSteps, toSlug } from "./stepResolvers/stepPipeline.js";
import { ErrorReporter } from "../ErrorReporter/index.js";
import { StepHookService } from "../StepHook/index.js";
import { CommandRunner } from "../CommandRunner/index.js";

interface IUpgradeSessionSqlRow {
    id: string;
    projectId: string;
    status: string;
    currentStep: string;
    steps: string;
    stepOrder: string | null;
    createdAt: number;
    updatedAt: number;
}

function toRow(row: IUpgradeSessionSqlRow): Abstraction.Row {
    const steps = JSON.parse(row.steps) as Abstraction.StepState[];
    return {
        id: row.id,
        projectId: row.projectId,
        status: row.status,
        currentStep: row.currentStep,
        steps,
        stepOrder: row.stepOrder ? (JSON.parse(row.stepOrder) as string[]) : steps.map(s => s.type),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

class UpgradeSessionServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly stepResolverRegistry: UpgradeSessionStepResolverRegistry.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly errorReporter: ErrorReporter.Interface,
        private readonly stepHookService: StepHookService.Interface,
        private readonly commandRunner: CommandRunner.Interface
    ) {}

    public async createSession(projectId: string): Promise<Abstraction.Row> {
        const project = await this.databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();

        if (!project) {
            throw new Error("Project not found");
        }

        const hooks = await this.stepHookService.getStepConfig(projectId, project.path);
        const stepOrder = buildStepOrder(hooks);
        const steps = createSessionSteps(stepOrder, hooks);
        const now = Date.now();
        const id = generateId();

        await this.databaseClient.db
            .insert(upgradeSessions)
            .values({
                id,
                projectId,
                status: "active",
                currentStep: steps[0]!.type,
                steps: JSON.stringify(steps),
                stepOrder: JSON.stringify(stepOrder),
                createdAt: now,
                updatedAt: now
            })
            .run();

        const created = await this.getSession(id, projectId);
        if (!created) {
            throw new Error("Failed to create session");
        }
        return created;
    }

    public async getSession(sessionId: string, projectId: string): Promise<Abstraction.Row | null> {
        const row = await this.databaseClient.db
            .select()
            .from(upgradeSessions)
            .where(and(eq(upgradeSessions.id, sessionId), eq(upgradeSessions.projectId, projectId)))
            .get();

        return row ? toRow(row) : null;
    }

    public async executeStep(
        sessionId: string,
        projectId: string,
        stepType: string,
        input: Record<string, unknown>
    ): Promise<Abstraction.Row> {
        const project = await this.databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();

        if (!project) {
            throw new Error("Project not found");
        }

        const session = await this.requireActiveSessionOnStep(sessionId, projectId, stepType);

        const customResolvers = await this.buildCustomResolvers(projectId, project.path);
        const resolver = this.stepResolverRegistry.getResolver(stepType, customResolvers);
        const onProgress = (log: string): void => {
            this.webSocketBroadcaster.broadcast("upgrade-session:step-progress", {
                sessionId,
                stepType,
                log
            });
        };
        const stepOrder = session.stepOrder;
        const context = {
            steps: session.steps,
            packageManager: project.packageManager ?? "yarn",
            stepOrder
        };
        let result;
        try {
            result = await resolver.execute({
                projectPath: project.path,
                context,
                input,
                onProgress
            });
        } catch (error) {
            await this.errorReporter.reportStepFailure(
                sessionId,
                stepType,
                projectId,
                project.name,
                project.path,
                error
            );
            throw error;
        }

        this.webSocketBroadcaster.broadcast("upgrade-session:step-complete", {
            sessionId,
            stepType
        });

        return this.advanceSession(session, result.updatedStep, result.nextStep);
    }

    public async skipStep(
        sessionId: string,
        projectId: string,
        stepType: string
    ): Promise<Abstraction.Row> {
        const session = await this.requireActiveSessionOnStep(sessionId, projectId, stepType);

        const project = await this.databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();

        const customResolvers = project
            ? await this.buildCustomResolvers(projectId, project.path)
            : [];
        const resolver = this.stepResolverRegistry.getResolver(stepType, customResolvers);
        if (resolver.required) {
            throw new Error(`Step ${stepType} is required and cannot be skipped`);
        }

        const currentStepState = session.steps.find(step => step.type === stepType);
        if (!currentStepState) {
            throw new Error(`Step ${stepType} not found in session`);
        }

        const updatedStep: Abstraction.StepState = { ...currentStepState, status: "skipped" };
        const nextStep = getNextStep(stepType, session.stepOrder);

        return this.advanceSession(session, updatedStep, nextStep);
    }

    public async abortSession(sessionId: string, projectId: string): Promise<Abstraction.Row> {
        const session = await this.getSession(sessionId, projectId);
        if (!session) {
            throw new Error("Session not found");
        }

        await this.databaseClient.db
            .update(upgradeSessions)
            .set({ status: "aborted", updatedAt: Date.now() })
            .where(and(eq(upgradeSessions.id, sessionId), eq(upgradeSessions.projectId, projectId)))
            .run();

        const updated = await this.getSession(sessionId, projectId);
        if (!updated) {
            throw new Error("Failed to abort session");
        }
        return updated;
    }

    private async requireActiveSessionOnStep(
        sessionId: string,
        projectId: string,
        stepType: string
    ): Promise<Abstraction.Row> {
        const session = await this.getSession(sessionId, projectId);
        if (!session) {
            throw new Error("Session not found");
        }

        if (session.status !== "active") {
            throw new Error("Session is not active");
        }

        if (session.currentStep !== stepType) {
            throw new Error(`Step ${stepType} is not the current step`);
        }

        return session;
    }

    private async buildCustomResolvers(
        projectId: string,
        projectPath: string
    ): Promise<IStepResolver[]> {
        const hooks = await this.stepHookService.getStepConfig(projectId, projectPath);

        return hooks.map(hook => {
            const stepType = `${hook.position}:${toSlug(hook.name)}`;
            const config: ICustomStepConfig = {
                name: hook.name,
                command: hook.command,
                executionType: hook.executionType,
                required: hook.required
            };
            return new CustomStepResolver(stepType, config, this.commandRunner);
        });
    }

    private async advanceSession(
        session: Abstraction.Row,
        updatedStep: Abstraction.StepState,
        nextStep: string | null
    ): Promise<Abstraction.Row> {
        const steps = session.steps.map(step =>
            step.type === updatedStep.type ? updatedStep : step
        );

        if (nextStep) {
            const nextIndex = steps.findIndex(step => step.type === nextStep);
            if (nextIndex !== -1) {
                steps[nextIndex] = { ...steps[nextIndex]!, status: "active" };
            }
        }

        await this.databaseClient.db
            .update(upgradeSessions)
            .set({
                status: nextStep ? "active" : "completed",
                currentStep: nextStep ?? updatedStep.type,
                steps: JSON.stringify(steps),
                updatedAt: Date.now()
            })
            .where(
                and(
                    eq(upgradeSessions.id, session.id),
                    eq(upgradeSessions.projectId, session.projectId)
                )
            )
            .run();

        const updated = await this.getSession(session.id, session.projectId);
        if (!updated) {
            throw new Error("Failed to advance session");
        }
        return updated;
    }
}

export const UpgradeSessionService = Abstraction.createImplementation({
    implementation: UpgradeSessionServiceImpl,
    dependencies: [
        DatabaseClient,
        UpgradeSessionStepResolverRegistry,
        WebSocketBroadcaster,
        ErrorReporter,
        StepHookService,
        CommandRunner
    ]
});
