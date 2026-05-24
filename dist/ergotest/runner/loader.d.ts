import { TestSuite } from "../tests/test_suite.js";
/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}. Also takes an optional list of setup modules, which are the only modules
 * that are allowed to define global before/after functions.
 * @param {string[]} testModuleFilenames The filenames of the test modules.
 * @param {string[]} [setupModuleFilenames] The filenames of the setup modules.
 * @returns {TestSuite} The test suite.
 */
export declare function fromModulesAsync(testModuleFilenames: string[], setupModuleFilenames?: string[]): Promise<TestSuite>;
