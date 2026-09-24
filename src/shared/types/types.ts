export type GenericRecord<K extends PropertyKey = PropertyKey, V = any> = Record<K, V>;

export type NonEmptyArray<T> = [T, ...T[]];

export type PossiblyUndefinedProperties<T> = {
    [K in keyof T]: T[K] extends undefined ? T[K] : T[K] | undefined;
};
