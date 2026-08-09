import { createAbstraction } from "#shared/index.js";

export interface ILogViewModel {
    id: string;
    level: string;
    source: string;
    projectName: string | null;
    message: string;
    details: string | null;
    createdAt: number;
}

export interface IProjectOption {
    label: string;
    value: string;
}

export interface ILogBrowserViewModel {
    loading: boolean;
    error: string | null;
    logs: ILogViewModel[];
    total: number;
    levelFilter: string | null;
    sourceFilter: string | null;
    projectFilter: string | null;
    projects: IProjectOption[];
    dateFrom: string | null;
    dateTo: string | null;
    page: number;
    pageSize: number;
    expandedLogId: string | null;
}

export interface ILogBrowserPresenter {
    get vm(): ILogBrowserViewModel;
    load: () => Promise<void>;
    setFilter: (field: string, value: string | null) => void;
    clearFilters: () => void;
    toggleDetails: (id: string) => void;
    deleteFiltered: () => Promise<void>;
    setPage: (page: number) => void;
    dispose: () => void;
}

export const LogBrowserPresenter =
    createAbstraction<ILogBrowserPresenter>("Ui/LogBrowserPresenter");

export namespace LogBrowserPresenter {
    export type Interface = ILogBrowserPresenter;
    export type ViewModel = ILogBrowserViewModel;
    export type LogViewModel = ILogViewModel;
}
