import { Abstraction } from "@webiny/di";

export type { Abstraction };

export function createAbstraction<T>(name: string): Abstraction<T> {
    return new Abstraction<T>(name);
}
