export const DEFAULT_PAGE_SIZES = {
    standard: 25,
    large: 50,
    small: 10
} as const;

export function computeTotalPages(totalCount: number, pageSize: number): number {
    return Math.ceil(totalCount / pageSize);
}
