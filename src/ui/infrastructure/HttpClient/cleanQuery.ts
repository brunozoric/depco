export function cleanQuery<T extends Record<string, unknown>>(query: T): Partial<T> | undefined {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return Object.keys(result).length > 0 ? (result as Partial<T>) : undefined;
}

export function cleanQueryRecord(
    query: Record<string, string | undefined>
): Record<string, string> | undefined {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
