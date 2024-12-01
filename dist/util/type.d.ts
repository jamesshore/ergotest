export interface TypeOptions {
    name?: string;
    allowExtraKeys?: boolean;
}
export interface DescribeOptions {
    articles?: boolean;
    atLeast?: boolean;
}
type SingleDescriptor = undefined | null | typeof NaN | Function;
interface StructDescriptor extends Record<string, TypeDescriptor> {
}
export type TypeDescriptor = SingleDescriptor | TypeDescriptor[] | StructDescriptor;
export declare const ANY_TYPE: (number | ObjectConstructor | StringConstructor | BooleanConstructor | NumberConstructor | ArrayConstructor | null | undefined)[];
export declare function check(arg: unknown, expectedTypes: TypeDescriptor, options?: TypeOptions): string | null;
export declare function describe(type: TypeDescriptor, options?: DescribeOptions): string;
export {};
