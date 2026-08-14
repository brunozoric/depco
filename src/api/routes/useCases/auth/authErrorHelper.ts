interface IServiceError {
    statusCode?: number;
    message?: string;
}

export interface IAuthUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export function toAuthUseCaseError(error: unknown, fallbackMessage: string): IAuthUseCaseError {
    const { statusCode, message } = error as IServiceError;
    return {
        code: "UNEXPECTED_ERROR",
        statusCode: statusCode ?? 500,
        message: message ?? fallbackMessage
    };
}
