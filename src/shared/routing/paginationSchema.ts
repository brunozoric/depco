import { z } from "zod";

export const paginationQuerySchema = {
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(200).optional()
};

export const sortOrderSchema = {
    sortOrder: z.enum(["asc", "desc"]).optional()
};
