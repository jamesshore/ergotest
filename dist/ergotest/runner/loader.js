// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import path from "node:path";
import { FailureTestCase, TestCase } from "../tests/test_case.js";
import { TestSuite } from "../tests/test_suite.js";
import { _loadSuiteAsync } from "../tests/test_api.js";
/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}. Also takes an optional list of setup modules, which are the only modules
 * that are allowed to define global before/after functions.
 * @param {string[]} testModuleFilenames The filenames of the test modules.
 * @param {string[]} [setupModuleFilenames] The filenames of the setup modules.
 * @returns {TestSuite} The test suite.
 */ export async function fromModulesAsync(testModuleFilenames, setupModuleFilenames = []) {
    ensure.signature(arguments, [
        Array,
        [
            Array,
            undefined
        ]
    ]);
    return await _loadSuiteAsync(setupModuleFilenames, testModuleFilenames, loadSetupAsync, loadTestAsync);
}
async function loadSetupAsync(setupModulePath) {
    return await loadModuleAsync(setupModulePath, "Setup module");
}
async function loadTestAsync(filename) {
    const description = "Test module";
    const test = await loadModuleAsync(filename, description);
    if (test instanceof TestSuite || test instanceof TestCase) {
        return test;
    } else {
        return createModuleLoadFailure(`Test module doesn't export a test suite: ${filename}`, filename, description);
    }
}
async function loadModuleAsync(filename, description) {
    if (!path.isAbsolute(filename)) {
        return createModuleLoadFailure(`${description} filenames must use absolute paths: ${filename}`, filename, description);
    }
    try {
        const { default: suite } = await import(filename);
        return suite;
    } catch (err) {
        return createModuleLoadFailure(err, filename, description);
    }
}
function createModuleLoadFailure(error, filename, description) {
    const name = `error when importing ${description.toLowerCase()} ${path.basename(filename)}`;
    return new FailureTestCase([
        name
    ], error);
}

//# sourceMappingURL=loader.js.map
