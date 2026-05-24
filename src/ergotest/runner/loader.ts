// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import path from "node:path";
import { FailureTestCase, TestCase } from "../tests/test_case.js";
import { TestSuite } from "../tests/test_suite.js";
import { _loadSuiteAsync } from "../tests/test_api.js";
import { Test } from "../tests/test.js";

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

	return await _loadSuiteAsync(setupModuleFilenames, testModuleFilenames, loadSetupAsync, loadTestAsync);
}

async function loadSetupAsync(setupModulePath: string): Promise<void | Test> {
	return await loadModuleAsync(setupModulePath, "Setup");
}

async function loadTestAsync(filename: string): Promise<Test> {
	const test = await loadModuleAsync(filename, "Test");
	if (test instanceof TestSuite || test instanceof TestCase) {
		return test;
	}
	else {
		return createModuleLoadFailure(`Test module doesn't export a test suite: ${filename}`, filename);
	}

}

async function loadModuleAsync(filename: string, description: string): Promise<Test> {
	if (!path.isAbsolute(filename)) {
		return createModuleLoadFailure(`${description} module filenames must use absolute paths: ${filename}`, filename);
	}
	try {
		const { default: suite } = await import(filename);
		return suite;
	}
	catch(err) {
		return createModuleLoadFailure(err, filename);
	}
}

function createModuleLoadFailure(error: unknown, filename: string): FailureTestCase {
	const name = `error when importing ${path.basename(filename)}`;
	return new FailureTestCase([ name ], error);
}
