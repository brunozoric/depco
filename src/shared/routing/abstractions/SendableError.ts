export interface SendableError {
    code: string;
    message: string;
    statusCode?: number;
    data?: unknown;
    stack?: string;
}
