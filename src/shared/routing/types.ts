import type { HTTPMethod } from "./defineRoute.js";

type BaseRequestArgs<TParams, TQuerystring> = [TQuerystring] extends [never]
    ? { params: TParams; query?: Record<string, string | string[]> }
    : { params: TParams; query: TQuerystring };

export type IRequestArgs<
    TMethod extends HTTPMethod,
    TParams,
    TBody,
    TQuerystring = never
> = TMethod extends "GET"
    ? BaseRequestArgs<TParams, TQuerystring> & { body?: never }
    : [TBody] extends [never]
      ? BaseRequestArgs<TParams, TQuerystring> & { body?: never }
      : BaseRequestArgs<TParams, TQuerystring> & { body: TBody };
