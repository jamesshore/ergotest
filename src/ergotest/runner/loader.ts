// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { TestMark } from "../results/test_result.js";
import path from "node:path";
import { FailureTestCase } from "../suite/test_case.js";
import { TestSuite } from "../suite/test_suite.js";

/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}.
 * @param {string[]} moduleFilenames The filenames of the test modules.
 * @returns {TestSuite} The test suite.
 */
export async function fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite> {
	ensure.signature(arguments, [ Array ]);

	const suites = await Promise.all(moduleFilenames.map(filename => loadModuleAsync(filename)));
	return new TestSuite("", TestMark.none, { tests: suites });

	async function loadModuleAsync(filename: string): Promise<TestSuite> {
		const errorName = `error when importing ${path.basename(filename)}`;

		if (!path.isAbsolute(filename)) {
			return createFailure(errorName, `Test module filenames must use absolute paths: ${filename}`);
		}
		try {
			const { default: suite } = await import(filename);
			if (suite instanceof TestSuite) {
				suite._setFilename(filename);
				return suite;
			}
			else {
				return createFailure(errorName, `Test module doesn't export a test suite: ${filename}`, filename);
			}
		}
		catch(err) {
			const code = (err as { code: string })?.code;
			if (code === "ERR_MODULE_NOT_FOUND") {
				return createFailure(errorName, `Test module not found: ${filename}`, filename);
			}
			else {
				return createFailure(errorName, err, filename);
			}
		}
	}

	function createFailure(name: string, error: unknown, filename?: string) {
		return new TestSuite("", TestMark.none, { tests: [ new FailureTestCase(name, error, filename) ] });
	}
}
