import { TypeDescriptor } from "./type.js";
export declare const ANY_TYPE: (number | ObjectConstructor | StringConstructor | BooleanConstructor | NumberConstructor | null | undefined)[];
/**
 * General-purpose runtime assertion. Throws an exception if the expression isn't true.
 * @param {boolean} expression the expression to check
 * @param {string} message the exception message to throw
 */
export declare function that(variable: unknown, message: string): void;
/**
 * Runtime assertion for code that shouldn't be reachable. Throws an exception.
 * @param {string} [message] the exception message to throw
 */
export declare function unreachable(message: string): never;
/**
 * Runtime assertion for variables that should be defined. Throws an exception if the variable is undefined.
 * @param {any} variable the variable to check
 * @param {string} variableName the name of the variable, which will be included in the exception message
 */
export declare function defined(variable: unknown, variableName: string): void;
/**
 * Runtime assertion for function signatures. Throws an exception if the function parameters don't match the expected
 * types exactly.
 * @param {any[]} args the function parameters (call it with 'arguments')
 * @param {any[]} sig The function signature as an array. Each element in the array describes the corresponding
 *   function parameter. Use JavaScript's class names for each type: String, Number, Array, etc. You can also use
 *   'undefined', 'null', and 'NaN'. For instances, use the name of your class or constructor function (e.g.,
 *   'MyClass'). For objects with specific properties, provide an object, and specify the type(s) of each property
 *   (e.g., { a: Number, b: [ undefined, String ]}). For parameters that allow multiple types, provide an array
 *   containing each type. For optional parameters, provide an array and include 'undefined' as one of the options
 *   (e.g., [ undefined, String ].
 * @param {string[]} [names] the names of each parameter (used in error messages)
 */
export declare function signature(args: IArguments, expectedSignature: TypeDescriptor[], names?: string[]): void;
/**
 * Runtime assertion for function signatures. Throws an exception if the function parameters don't match the expected
 * types, but doesn't complain if there are more parameters or object properties than expected.
 * @param {any[]} args the function parameters (call it with 'arguments')
 * @param {any[]} sig The function signature as an array. Each element in the array describes the corresponding
 *   function parameter. Use JavaScript's class names for each type: String, Number, Array, etc. You can also use
 *   'undefined', 'null', and 'NaN'. For instances, use the name of your class or constructor function (e.g.,
 *   'MyClass'). For objects with specific properties, provide an object, and specify the type(s) of each property
 *   (e.g., { a: Number, b: [ undefined, String ]}). For parameters that allow multiple types, provide an array
 *   containing each type. For optional parameters, provide an array and include 'undefined' as one of the options
 *   (e.g., [ undefined, String ].
 * @param {string[]} [names] the names of each parameter (used in error messages)
 */
export declare function signatureMinimum(args: IArguments, expectedSignature: TypeDescriptor[], names?: string[]): void;
/**
 * Runtime assertion for variable types. Throws an exception if the variable doesn't match the expected type exactly.
 * @param {any} variable the variable
 * @param {any} expectedType The expected type. Use JavaScript's class names: String, Number, Array, etc. You can also
 *   use 'undefined', 'null', and 'NaN'. For instances, use the name of your class or constructor function (e.g.,
 *   'MyClass'). For objects with specific properties, provide an object, and specify the type(s) of each property
 *   (e.g., { a: Number, b: [ undefined, String ]}). For parameters that allow multiple types, provide an array
 *   containing each type. For optional parameters, provide an array and include 'undefined' as one of the options
 *   (e.g., [ undefined, String ].
 * @param {string} [name] the name of the variable (used in error messages)
 */
export declare function type(variable: unknown, expectedType: TypeDescriptor, name?: string): void;
/**
 * Runtime assertion for variable types. Throws an exception if the variable doesn't match the expected type, but
 * doesn't complain if there are more object properties than expected.
 * @param {any} variable the variable
 * @param {any} expectedType The expected type. Use JavaScript's class names: String, Number, Array, etc. You can also
 *   use 'undefined', 'null', and 'NaN'. For instances, use the name of your class or constructor function (e.g.,
 *   'MyClass'). For objects with specific properties, provide an object, and specify the type(s) of each property
 *   (e.g., { a: Number, b: [ undefined, String ]}). For parameters that allow multiple types, provide an array
 *   containing each type. For optional parameters, provide an array and include 'undefined' as one of the options
 *   (e.g., [ undefined, String ].
 * @param {string} [name] the name of the variable (used in error messages)
 */
export declare function typeMinimum(variable: unknown, expectedType: TypeDescriptor, name?: string): void;
export declare function checkSignature(allowExtra: boolean, args: IArguments, signature?: TypeDescriptor[], names?: string[], fnToRemoveFromStackTrace?: Function): void;
export declare function checkType(variable: unknown, expectedType: TypeDescriptor, allowExtraKeys: boolean, name: string | undefined, fnToRemoveFromStackTrace?: Function): void;
