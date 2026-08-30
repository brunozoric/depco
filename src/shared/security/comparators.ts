import { toBoolean } from "@webiny/stdlib";
import { parseDuration } from "./duration.js";

export function booleanCompare(actual: unknown, expected: string): boolean {
    if (actual == null) {
        return false;
    }
    return toBoolean(actual) === toBoolean(expected);
}

export function existsCompare(actual: unknown, _expected: string): boolean {
    return actual != null && Array.isArray(actual);
}

export function durationCompare(actual: unknown, expected: string): boolean {
    if (actual == null) {
        return false;
    }
    try {
        return parseDuration(String(actual)) >= parseDuration(expected);
    } catch {
        return false;
    }
}

export function numericMinutesCompare(actual: unknown, expected: string): boolean {
    if (actual == null) {
        return false;
    }
    const actualMinutes = Number(actual);
    const expectedMinutes = Number(expected);
    if (Number.isNaN(actualMinutes) || Number.isNaN(expectedMinutes)) {
        return false;
    }
    return actualMinutes >= expectedMinutes;
}
