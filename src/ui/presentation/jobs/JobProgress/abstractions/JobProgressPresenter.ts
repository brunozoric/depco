import { createAbstraction } from "#shared/index.js";

export interface IJobProgressActiveJobViewModel {
    id: string;
    type: "dependency" | "transient" | "yarn";
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
    logs: string;
    startedAt: number | null;
    completedAt: number | null;
    progress: number | null;
    progressLabel: string | null;
}

export interface IJobProgressHistoryJobViewModel {
    id: string;
    type: "dependency" | "transient" | "yarn";
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
    startedAt: number | null;
    completedAt: number | null;
    warning: string | null;
}

export interface IJobProgressViewModel {
    activeJob: IJobProgressActiveJobViewModel | null;
    history: IJobProgressHistoryJobViewModel[];
    tracking: boolean;
}

export interface IJobProgressPresenter {
    get vm(): IJobProgressViewModel;
    trackJob: (referenceId: string, jobId: string) => Promise<void>;
    untrackJob: () => void;
    loadHistory: (referenceId: string) => Promise<void>;
}

export const JobProgressPresenter =
    createAbstraction<IJobProgressPresenter>("Ui/JobProgressPresenter");

export namespace JobProgressPresenter {
    export type Interface = IJobProgressPresenter;
    export type ViewModel = IJobProgressViewModel;
    export type ActiveJobViewModel = IJobProgressActiveJobViewModel;
    export type HistoryJobViewModel = IJobProgressHistoryJobViewModel;
}
