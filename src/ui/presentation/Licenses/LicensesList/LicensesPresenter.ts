import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
import { LicensesPresenter as Abstraction } from "./abstractions/LicensesPresenter.js";
import { LoadLicensesUseCase } from "../useCases/abstractions/LoadLicensesUseCase.js";
import { ManagePolicyRulesUseCase } from "../useCases/abstractions/ManagePolicyRulesUseCase.js";
import { ScanLicensesUseCase } from "../useCases/abstractions/ScanLicensesUseCase.js";
import { LicensesRepository } from "../../../features/Licenses/abstractions/LicensesRepository.js";
import { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { LoadProjectsUseCase } from "../../Projects/useCases/abstractions/LoadProjectsUseCase.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";
import type { z } from "zod";
import { listLicensesRoute } from "#shared/routes/index.js";
import { getErrorMessage } from "#shared/errors.js";

const FILTER_SCHEMA = listLicensesRoute.querystring as NonNullable<
    typeof listLicensesRoute.querystring
> &
    z.ZodObject<z.ZodRawShape>;

const DEFAULT_PAGE_SIZE = 50;

class LicensesPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private readonly disposeTeamReaction: () => void;
    private readonly disposeUrlListener: () => void;

    private readonly handleLicenseScanComplete: EventBridge.Callback<"license-scan:complete">;

    public constructor(
        private readonly loadLicensesUseCase: LoadLicensesUseCase.Interface,
        private readonly managePolicyRulesUseCase: ManagePolicyRulesUseCase.Interface,
        private readonly scanLicensesUseCase: ScanLicensesUseCase.Interface,
        private readonly repository: LicensesRepository.Interface,
        private readonly gateway: LicensesGateway.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleLicenseScanComplete = () => {
            void this.load();
        };
        this.eventBridge.on("license-scan:complete", this.handleLicenseScanComplete);

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            void this.load();
        });
    }

    public get vm(): Abstraction.ViewModel {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const rows = this.buildRows();
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const totalCount = this.repository.getLicensesTotal();

        return {
            loading: this.loading,
            error: this.error,
            licenses: rows,
            totalCount,
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            sortBy: urlFilters.sortBy ?? "packageName",
            sortOrder: urlFilters.sortOrder ?? "asc",
            summary: this.buildSummaryViewModel(),
            policyRules: this.repository
                .getPolicies()
                .map(rule => this.toPolicyRuleViewModel(rule)),
            availableProjects: this.projectsRepository.getProjects().map(project => ({
                id: project.id,
                name: project.name
            })),
            riskTierFilter: urlFilters.riskTier ?? null,
            packageNameFilter: urlFilters.packageName ?? "",
            projectIdFilter: urlFilters.projectId ?? null,
            violationFilter: urlFilters.violationAction ?? null
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            const teamId = this.teamFilterService.selectedTeamId;
            const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
            const filters: LicensesGateway.ListFilters = {
                ...(urlFilters.projectId ? { projectId: urlFilters.projectId } : {}),
                ...(urlFilters.riskTier ? { riskTier: urlFilters.riskTier } : {}),
                ...(urlFilters.packageName ? { packageName: urlFilters.packageName } : {}),
                ...(urlFilters.spdxId ? { spdxId: urlFilters.spdxId } : {}),
                ...(urlFilters.violationAction
                    ? { violationAction: urlFilters.violationAction }
                    : {}),
                ...(teamId ? { teamId } : {}),
                page: urlFilters.page ?? 1,
                pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE,
                sortBy: urlFilters.sortBy ?? "packageName",
                sortOrder: urlFilters.sortOrder ?? "asc"
            };
            const tasks: Promise<unknown>[] = [
                this.loadLicensesUseCase.execute(filters),
                this.gateway.listPolicies()
            ];
            if (this.projectsRepository.getProjects().length === 0) {
                tasks.push(this.loadProjectsUseCase.execute());
            }
            const [, policyListResponse] = (await Promise.all(tasks)) as [
                void,
                { items: LicensesGateway.PolicyRule[] }
            ];
            runInAction(() => {
                this.repository.setPolicies(policyListResponse.items);
            });
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to load licenses");
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setRiskTierFilter = (tier: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { riskTier: tier, page: null });
    };

    public setPackageNameFilter = (name: string): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { packageName: name || null, page: null });
    };

    public setProjectIdFilter = (projectId: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { projectId, page: null });
    };

    public setViolationFilter = (action: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { violationAction: action, page: null });
    };

    public setPage = (page: number): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { page: String(page) });
    };

    public setSortBy = (sortBy: string): void => {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const currentSortBy = urlFilters.sortBy ?? "packageName";
        const newSortOrder =
            currentSortBy === sortBy
                ? (urlFilters.sortOrder ?? "asc") === "asc"
                    ? "desc"
                    : "asc"
                : "asc";
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy,
            sortOrder: newSortOrder,
            page: null
        });
    };

    public createRule = async (input: LicensesGateway.CreatePolicyInput): Promise<void> => {
        await this.managePolicyRulesUseCase.create(input);
        await this.load();
    };

    public updateRule = async (
        id: string,
        input: LicensesGateway.UpdatePolicyInput
    ): Promise<void> => {
        await this.managePolicyRulesUseCase.update(id, input);
        await this.load();
    };

    public deleteRule = async (id: string): Promise<void> => {
        await this.managePolicyRulesUseCase.remove(id);
        await this.load();
    };

    public scanProject = async (projectId: string): Promise<void> => {
        await this.scanLicensesUseCase.execute(projectId);
    };

    public dispose = (): void => {
        this.eventBridge.off("license-scan:complete", this.handleLicenseScanComplete);
        this.disposeTeamReaction();
        this.disposeUrlListener();
    };

    private buildRows(): Abstraction.LicenseRow[] {
        const violationActionsByLicenseId = new Map<string, Set<string>>();
        for (const violation of this.repository.getViolations()) {
            const actions = violationActionsByLicenseId.get(violation.licenseId) ?? new Set();
            actions.add(violation.action);
            violationActionsByLicenseId.set(violation.licenseId, actions);
        }

        const projectNameMap = new Map<string, string>();
        for (const project of this.projectsRepository.getProjects()) {
            projectNameMap.set(project.id, project.name);
        }

        return this.repository.getLicenses().map((license): Abstraction.LicenseRow => {
            const actions = violationActionsByLicenseId.get(license.id);
            const violationAction: "warn" | "deny" | null = actions?.has("deny")
                ? "deny"
                : actions?.has("warn")
                  ? "warn"
                  : null;

            return {
                id: license.id,
                projectId: license.projectId,
                projectName: projectNameMap.get(license.projectId) ?? license.projectId,
                packageName: license.packageName,
                licenseName: license.licenseName,
                spdxId: license.spdxId,
                riskTier: license.riskTier,
                source: license.source,
                violationAction
            };
        });
    }

    private buildSummaryViewModel(): Abstraction.ComplianceSummary | null {
        const summary = this.repository.getSummary();
        if (!summary) {
            return null;
        }

        return {
            totalPackages: summary.totalPackages,
            compliantPercent: summary.compliantPercent,
            riskTierCounts: summary.riskTierCounts,
            warnCount: summary.violationCounts.warn,
            denyCount: summary.violationCounts.deny
        };
    }

    private toPolicyRuleViewModel(rule: LicensesGateway.PolicyRule): Abstraction.PolicyRule {
        return {
            id: rule.id,
            action: rule.action,
            licensePattern: rule.licensePattern,
            packagePattern: rule.packagePattern,
            projectId: rule.projectId,
            priority: rule.priority,
            reason: rule.reason
        };
    }
}

export const LicensesPresenter = Abstraction.createImplementation({
    implementation: LicensesPresenterImpl,
    dependencies: [
        LoadLicensesUseCase,
        ManagePolicyRulesUseCase,
        ScanLicensesUseCase,
        LicensesRepository,
        LicensesGateway,
        EventBridge,
        LoadProjectsUseCase,
        ProjectsRepository,
        TeamFilterService,
        UrlFilterService
    ]
});
