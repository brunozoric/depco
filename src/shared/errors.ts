export function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export function unexpectedError(error: unknown): IUnexpectedError {
    return {
        code: "UNEXPECTED_ERROR",
        statusCode: 500,
        message: error instanceof Error ? error.message : "Unknown error"
    };
}
