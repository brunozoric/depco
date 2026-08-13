interface IServiceError {
    statusCode?: number;
    message?: string;
}

export interface IAuthUseCaseError {
    statusCode: number;
    message: string;
}

export function toAuthUseCaseError(error: unknown, fallbackMessage: string): IAuthUseCaseError {
    const { statusCode, message } = error as IServiceError;
    return { statusCode: statusCode ?? 500, message: message ?? fallbackMessage };
}
