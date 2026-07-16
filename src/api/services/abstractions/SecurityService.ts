import { createAbstraction } from "#shared/index.js";

export interface ISecurityCheckResult {
    passes: boolean;
    checks: Record<string, boolean>;
}

export interface ISecurityService {
    check(projectId: string, projectPath: string): Promise<ISecurityCheckResult>;
    getLatest(projectId: string): Promise<ISecurityCheckResult | null>;
}

export const SecurityService = createAbstraction<ISecurityService>("Api/SecurityService");

export namespace SecurityService {
    export type Interface = ISecurityService;
    export type CheckResult = ISecurityCheckResult;
}
