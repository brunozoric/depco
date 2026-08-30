/**
 * Converts an epoch-ms string (as stored by presenters) into the local
 * "YYYY-MM-DDTHH:mm" format expected by <input type="datetime-local">.
 */
export function epochMsToDatetimeLocal(value: string | null): string {
    if (!value) {
        return "";
    }
    const ms = Number(value);
    if (Number.isNaN(ms)) {
        return "";
    }
    const date = new Date(ms);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Converts a datetime-local input value back into an epoch-ms string,
 * or null when the input was cleared / invalid.
 */
export function datetimeLocalToEpochMs(value: string): string | null {
    if (!value) {
        return null;
    }
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) {
        return null;
    }
    return String(ms);
}
