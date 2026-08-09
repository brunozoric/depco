import type { z } from "zod";
import { UrlFilterService as Abstraction } from "./abstractions/UrlFilterService.js";

class UrlFilterServiceImpl implements Abstraction.Interface {
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    public read<TSchema extends z.ZodObject<z.ZodRawShape>>(
        schema: TSchema
    ): Partial<z.infer<TSchema>> {
        const searchParams = new URLSearchParams(window.location.search);
        const raw: Record<string, string> = {};
        for (const [key, value] of searchParams.entries()) {
            raw[key] = value;
        }

        const result = schema.partial().safeParse(raw);
        if (!result.success) {
            return {};
        }

        const parsed = result.data as Record<string, unknown>;
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (value !== undefined) {
                filtered[key] = value;
            }
        }
        return filtered as Partial<z.infer<TSchema>>;
    }

    public update<TSchema extends z.ZodObject<z.ZodRawShape>>(
        _schema: TSchema,
        params: Partial<Record<keyof z.infer<TSchema>, string | null>>
    ): void {
        const searchParams = new URLSearchParams(window.location.search);

        for (const [key, value] of Object.entries(params)) {
            if (value === null || value === undefined) {
                searchParams.delete(key);
            } else {
                searchParams.set(key, value);
            }
        }

        const search = searchParams.toString();
        const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
        window.history.pushState(null, "", url);

        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            window.dispatchEvent(new PopStateEvent("popstate"));
        }, 300);
    }

    public onChange(callback: () => void): () => void {
        window.addEventListener("popstate", callback);
        return () => {
            window.removeEventListener("popstate", callback);
        };
    }
}

export const UrlFilterService = Abstraction.createImplementation({
    implementation: UrlFilterServiceImpl,
    dependencies: []
});
