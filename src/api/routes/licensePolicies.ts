import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendError } from "#shared/routing/index.js";
import {
    listLicensePoliciesRoute,
    createLicensePolicyRoute,
    updateLicensePolicyRoute,
    deleteLicensePolicyRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface ILicensePolicyQuerystring {
    projectId?: string | undefined;
}

function buildLicensePolicyConditions(query: ILicensePolicyQuerystring): SQL[] {
    const conditions: SQL[] = [];
    if (query.projectId) {
        conditions.push(eq(licensePolicyRules.projectId, query.projectId));
    }
    return conditions;
}

export async function licensePolicyRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listLicensePoliciesRoute, {}, async (request, reply) => {
        const conditions = buildLicensePolicyConditions(request.query);
        const items =
            conditions.length > 0
                ? await db
                      .select()
                      .from(licensePolicyRules)
                      .where(and(...conditions))
                      .all()
                : await db.select().from(licensePolicyRules).all();
        reply.send({ items });
    });

    registerRoute(app, createLicensePolicyRoute, {}, async (request, reply) => {
        const body = request.body;
        const now = Date.now();

        const rule = {
            id: generateId(),
            action: body.action,
            licensePattern: body.licensePattern ?? null,
            packagePattern: body.packagePattern ?? null,
            projectId: body.projectId ?? null,
            priority: body.priority,
            reason: body.reason ?? null,
            createdAt: now,
            updatedAt: now
        };

        await db.insert(licensePolicyRules).values(rule).run();
        reply.status(201).send(rule);
    });

    registerRoute(app, updateLicensePolicyRoute, {}, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;

        const existing = await db
            .select()
            .from(licensePolicyRules)
            .where(eq(licensePolicyRules.id, id))
            .get();
        if (!existing) {
            sendError(reply, 404, "License policy rule not found");
            return;
        }

        const updates = {
            action: body.action ?? existing.action,
            licensePattern:
                body.licensePattern !== undefined ? body.licensePattern : existing.licensePattern,
            packagePattern:
                body.packagePattern !== undefined ? body.packagePattern : existing.packagePattern,
            projectId: body.projectId !== undefined ? body.projectId : existing.projectId,
            priority: body.priority ?? existing.priority,
            reason: body.reason !== undefined ? body.reason : existing.reason,
            updatedAt: Date.now()
        };

        await db.update(licensePolicyRules).set(updates).where(eq(licensePolicyRules.id, id)).run();

        reply.send({ ...existing, ...updates });
    });

    registerRoute(app, deleteLicensePolicyRoute, {}, async (request, reply) => {
        const { id } = request.params;
        await db.delete(licensePolicyRules).where(eq(licensePolicyRules.id, id)).run();
        reply.send({ deleted: true });
    });
}
