import { createAbstraction } from "#shared/index.js";

export interface IJobViewModel {
    id: string;
    referenceId: string;
    referenceType: string;
    projectName: string;
    type: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
    canCancel: boolean;
    logs: string | null;
    warning: string | null;
    parentJobId: string | null;
    progress: number | null;
    progressLabel: string | null;
}

export interface IProjectOption {
    label: string;
    value: string;
}

export interface IJobManagerViewModel {
    loading: boolean;
    statusFilter: string | null;
    typeFilter: string | null;
    referenceFilter: string | null;
    references: IProjectOption[];
    dateFrom: string | null;
    dateTo: string | null;
    jobs: IJobViewModel[];
    total: number;
    page: number;
    pageSize: number;
    expandedJobId: string | null;
}

export interface IJobManagerPresenter {
    get vm(): IJobManagerViewModel;
    load: () => Promise<void>;
    setStatusFilter: (status: string | null) => Promise<void>;
    setFilter: (field: string, value: string | null) => void;
    clearFilters: () => void;
    setPage: (page: number) => void;
    cancel: (jobId: string) => Promise<void>;
    deleteFiltered: () => Promise<void>;
    toggleJobDetails: (jobId: string) => void;
    dispose: () => void;
}

export const JobManagerPresenter =
    createAbstraction<IJobManagerPresenter>("Ui/JobManagerPresenter");

export namespace JobManagerPresenter {
    export type Interface = IJobManagerPresenter;
    export type ViewModel = IJobManagerViewModel;
    export type JobViewModel = IJobViewModel;
    export type ProjectOption = IProjectOption;
}
