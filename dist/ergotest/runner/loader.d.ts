import { TestSuite } from "../tests/test_suite.js";
/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}.
 * @param {string[]} moduleFilenames The filenames of the test modules.
 * @returns {TestSuite} The test suite.
 */
export declare function fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite>;
