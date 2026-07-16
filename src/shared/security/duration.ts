const UNITS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };

export function parseDuration(value: string): number {
    const match = value.match(/^(\d+)([dhms])$/) as RegExpMatchArray | null;
    if (!match) {
        throw new Error(`Invalid duration: "${value}". Expected format: <number><d|h|m|s>`);
    }
    const amount = match[1] as string;
    const unit = match[2] as string;
    const unitSeconds = UNITS[unit];
    if (unitSeconds === undefined) {
        throw new Error(`Invalid duration unit: "${unit}"`);
    }
    return parseInt(amount, 10) * unitSeconds;
}
