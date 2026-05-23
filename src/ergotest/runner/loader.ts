// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import path from "node:path";
import { FailureTestCase } from "../tests/test_case.js";
import { TestSuite } from "../tests/test_suite.js";
import { context } from "../tests/test_api.js";

/**
 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
 * {@link TestSuite.create}.
 * @param {string[]} moduleFilenames The filenames of the test modules.
 * @returns {TestSuite} The test suite.
 */
export async function fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite> {
	ensure.signature(arguments, [ Array ]);

	const setupFilename = path.resolve(process.cwd(), "generated/src/_test_setup.js");
	const testSuites = await Promise.all(moduleFilenames.map(filename => loadModuleAsync(filename)));
	const result = await extracted(testSuites, async () => {
		await import(setupFilename);
		return testSuites;
	});
	result._setFilename(setupFilename);
	return result;

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
			return createFailure(errorName, err, filename);
		}
	}

	function createFailure(name: string, error: unknown, filename?: string) {
		return TestSuite.create({ tests: [ new FailureTestCase([ name ], error, filename) ] });
	}
}

async function extracted(testSuites, fn: () => Promise<void>) {
	const builder = context.setup();
	try {
		await fn();
		builder._tests = testSuites;
		return builder.toTestSuite();
	}
	finally {
		context.endSetup();
	}
}

