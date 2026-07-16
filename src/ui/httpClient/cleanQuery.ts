export function cleanQuery<T extends Record<string, unknown>>(query: T): Partial<T> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result as Partial<T>;
}
