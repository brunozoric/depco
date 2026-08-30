export function truncate(value: string, max = 60): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}
