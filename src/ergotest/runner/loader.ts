// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { TestMark } from "../results/test_result.js";
import path from "node:path";
import { FailureTestCase } from "../tests/test_case.js";
import { TestSuite } from "../tests/test_suite.js";
import { _loadSuiteAsync } from "../tests/test_api.js";

/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}. Also takes an optional list of setup modules, which are the only modules
 * that are allowed to define global before/after functions.
 * @param {string[]} testModuleFilenames The filenames of the test modules.
 * @param {string[]} [setupModuleFilenames] The filenames of the setup modules.
 * @returns {TestSuite} The test suite.
 */
export async function fromModulesAsync(
	testModuleFilenames: string[],
	setupModuleFilenames: string[] = [],
): Promise<TestSuite> {
	ensure.signature(arguments, [ Array, [ Array, undefined ] ]);

	const result = await _loadSuiteAsync(setupModuleFilenames, testModuleFilenames, loadSetupAsync, loadTestAsync);
	return result;
}

async function loadSetupAsync(setupModulePath: string) {
	// try {
		await import(setupModulePath);
	// }
	// catch(err) {
	// 	return createFailure("TBD", err, setupModulePath);
	// }
}

async function loadTestAsync(testModuleFilename: string): Promise<TestSuite> {
	return await loadModuleAsync(testModuleFilename);
}

async function loadModuleAsync(filename: string): Promise<TestSuite> {
	const errorName = `error when importing ${path.basename(filename)}`;

	if (!path.isAbsolute(filename)) {
		return createFailure(errorName, `Test module filenames must use absolute paths: ${filename}`);
	}
	try {
		const { default: suite } = await import(filename);
		if (suite instanceof TestSuite) {
			return suite;
		}
		else {
			return createFailure(errorName, `Test module doesn't export a test suite: ${filename}`, filename);
		}
	}
	catch(err) {
		return createFailure(errorName, err, filename);
	}
}

function createFailure(name: string, error: unknown, filename?: string) {
	return TestSuite.create({ tests: [ new FailureTestCase([ name ], error, filename) ] });
}
