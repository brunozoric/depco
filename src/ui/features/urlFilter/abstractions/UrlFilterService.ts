import type { z } from "zod";
import { createAbstraction } from "#shared/index.js";

export interface IUrlFilterService {
    read<TSchema extends z.ZodObject<z.ZodRawShape>>(schema: TSchema): Partial<z.infer<TSchema>>;
    update<TSchema extends z.ZodObject<z.ZodRawShape>>(
        schema: TSchema,
        params: Partial<Record<keyof z.infer<TSchema>, string | null>>
    ): void;
    onChange(callback: () => void): () => void;
}

export const UrlFilterService = createAbstraction<IUrlFilterService>("Ui/UrlFilterService");

export namespace UrlFilterService {
    export type Interface = IUrlFilterService;
}
