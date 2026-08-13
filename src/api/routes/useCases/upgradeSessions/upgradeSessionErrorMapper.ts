export function mapUpgradeSessionErrorStatus(message: string): number {
    if (message.includes("not found")) {
        return 404;
    }
    if (message.includes("not active")) {
        return 409;
    }
    if (
        message.includes("not the current step") ||
        message.includes("required") ||
        message.includes("non-empty array") ||
        message.includes("is required") ||
        message.includes("No packages")
    ) {
        return 400;
    }
    return 500;
}
