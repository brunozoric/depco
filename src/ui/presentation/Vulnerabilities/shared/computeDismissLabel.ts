export function computeDismissLabel(
    dismissedAt: number | null,
    dismissedUntil: number | null
): string | null {
    if (!dismissedAt) {
        return null;
    }
    if (dismissedUntil) {
        if (dismissedUntil < Date.now()) {
            return null;
        }
        return `Snoozed until ${new Date(dismissedUntil).toLocaleDateString()}`;
    }
    return "Dismissed";
}
