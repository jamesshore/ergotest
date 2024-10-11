import * as typeLib from "../util/type.js";
interface ObjEquals {
    equals(that: unknown): boolean;
}
interface Includes {
    includes(any: unknown): boolean;
}
export declare function fail(message: string): never;
export declare function todo(message?: string): never;
export declare function defined(actual: unknown, message?: string): void;
export declare function isUndefined(actual: unknown, message?: string): void;
export declare function isTrue(actual: unknown, message?: string): void;
export declare function isFalse(actual: unknown, message?: string): void;
export declare function isNull(actual: unknown, message?: string): void;
export declare function isNotNull(actual: unknown, message?: string): void;
export declare function atLeast(actual: number, expected: number, message?: string): void;
export declare function atMost(actual: number, expected: number, message?: string): void;
export declare function equal(actual: unknown, expected: unknown, message?: string): void;
export declare function notEqual(actual: unknown, expected: unknown, message?: string): void;
export declare function deepEqual(actual: unknown, expected: unknown, message?: string): void;
export declare function type(actual: unknown, expected: typeLib.TypeDescriptor, message?: string): void;
export declare function objEqual(actual: unknown, expected: ObjEquals, message?: string): void;
export declare function objNotEqual(actual: ObjEquals, expected: unknown, message?: string): void;
export declare function between(value: number, min: number, max: number, message?: string): void;
export declare function match(actual: unknown, expectedRegex: RegExp, message?: string): void;
export declare function matchesGroup(actual: string, regex: RegExp, expectedMatch: string | null, message?: string | null): void;
export declare function includes(actual: Includes, expected: unknown, message?: string): void;
export declare function notIncludes(actual: Includes, expected: unknown, message?: string): void;
export declare function noException(fn: Function): void;
export declare function exception(fn: Function, expectedRegexOrExactString?: RegExp | string, message?: string): void;
export declare function exceptionAsync(fnAsync: Function, expectedRegexOrExactString?: RegExp | string, message?: string): Promise<void>;
export declare function noExceptionAsync(fnAsync: Function): Promise<void>;
export {};
