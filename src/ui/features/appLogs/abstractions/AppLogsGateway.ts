import { createAbstraction } from "#shared/index.js";

export interface IAppLogEntry {
    id: string;
    level: string;
    source: string;
    projectId: string | null;
    message: string;
    details: string | null;
    createdAt: number;
}

export interface IAppLogsFilters {
    level?: string;
    source?: string;
    projectId?: string;
    from?: string;
    to?: string;
}

export interface IAppLogsListResponse {
    items: IAppLogEntry[];
    total: number;
}

export interface IAppLogsGateway {
    list(filters: IAppLogsFilters, limit?: number, offset?: number): Promise<IAppLogsListResponse>;
    deleteFiltered(filters: IAppLogsFilters): Promise<number>;
}

export const AppLogsGateway = createAbstraction<IAppLogsGateway>("Ui/AppLogsGateway");

export namespace AppLogsGateway {
    export type Interface = IAppLogsGateway;
    export type LogEntry = IAppLogEntry;
    export type Filters = IAppLogsFilters;
    export type ListResponse = IAppLogsListResponse;
}
