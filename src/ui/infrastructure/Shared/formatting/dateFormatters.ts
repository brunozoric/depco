/**
 * Formats a timestamp as a relative time string (e.g., "Today", "3 days ago",
 * "2 months ago", "1 years ago").
 */
export function formatRelativeTime(timestamp: number): string {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) {
        return "Today";
    }
    if (days === 1) {
        return "1 day ago";
    }
    if (days < 30) {
        return `${days} days ago`;
    }
    if (days < 365) {
        return `${Math.floor(days / 30)} months ago`;
    }
    return `${Math.floor(days / 365)} years ago`;
}

/**
 * Formats a timestamp as a compact relative time string with finer granularity
 * (e.g., "just now", "5m ago", "3h ago", "2d ago").
 */
export function formatTimeAgo(timestamp: number | null, fallback = "—"): string {
    if (!timestamp) {
        return fallback;
    }
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
        return "just now";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Formats a timestamp as a short locale date string (e.g., "8/15/2024").
 * Returns the given fallback string when the timestamp is null.
 */
export function formatDate(timestamp: number | null, fallback = "—"): string {
    if (timestamp === null || timestamp === undefined) {
        return fallback;
    }
    return new Date(timestamp).toLocaleDateString();
}

/**
 * Formats a timestamp as a detailed date string with time, using the
 * "en-US" locale (e.g., "Aug 15, 2024, 02:30 PM").
 * Returns the given fallback string when the timestamp is null.
 */
export function formatDateDetailed(timestamp: number | null, fallback = "—"): string {
    if (timestamp === null || timestamp === undefined) {
        return fallback;
    }
    return new Date(timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/**
 * Formats a timestamp as a full locale datetime string (e.g., "8/15/2024, 2:30:00 PM").
 * Returns the given fallback string when the timestamp is null.
 */
export function formatTimestamp(timestamp: number | null, fallback = "—"): string {
    if (!timestamp) {
        return fallback;
    }
    return new Date(timestamp).toLocaleString();
}
