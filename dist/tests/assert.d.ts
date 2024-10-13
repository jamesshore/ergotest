import { TypeDescriptor as TypeLibDescriptor } from "../util/type.js";
interface DotEquals {
    equals(that: unknown): boolean;
}
interface Includes {
    includes(any: unknown): boolean;
}
export type TypeDescriptor = TypeLibDescriptor;
export declare function fail(message: string): never;
export declare function todo(message?: string): never;
export declare function identity(actual: unknown, expected: unknown, message?: string): void;
export declare function notIdentity(actual: unknown, expected: unknown, message?: string): void;
export declare function equal(actual: unknown, expected: unknown, message?: string): void;
export declare function notEqual(actual: unknown, expected: unknown, message?: string): void;
export declare function dotEquals(actual: unknown, expected: DotEquals, message?: string): void;
export declare function notDotEquals(actual: unknown, expected: DotEquals, message?: string): void;
export declare function isDefined(actual: unknown, message?: string): void;
export declare function isUndefined(actual: unknown, message?: string): void;
export declare function isTrue(actual: unknown, message?: string): void;
export declare function isFalse(actual: unknown, message?: string): void;
export declare function isNull(actual: unknown, message?: string): void;
export declare function isNotNull(actual: unknown, message?: string): void;
export declare function atLeast(actual: unknown, expected: unknown, message?: string): void;
export declare function atMost(actual: unknown, expected: unknown, message?: string): void;
export declare function between(actual: unknown, min: unknown, max: unknown, message?: string): void;
export declare function match(actual: string, expected: RegExp, message?: string): void;
export declare function matchesGroup(actual: string, regex: RegExp, expectedMatch: string | null, message?: string): void;
export declare function includes(actual: Includes, expected: unknown, message?: string): void;
export declare function notIncludes(actual: Includes, expected: unknown, message?: string): void;
export declare function error(fn: Function, expected?: RegExp | string, message?: string): void;
export declare function notError(fn: Function): void;
export declare function errorAsync(fnAsync: Function, expectedRegexOrExactString?: RegExp | string, message?: string): Promise<void>;
export declare function notErrorAsync(fnAsync: Function): Promise<void>;
export declare function type(actual: unknown, expected: TypeDescriptor, message?: string): void;
export {};
