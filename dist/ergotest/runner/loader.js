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
 */ export async function fromModulesAsync(moduleFilenames) {
    ensure.signature(arguments, [
        Array
    ]);
    const testSuites = await Promise.all(moduleFilenames.map((filename)=>loadModuleAsync(filename)));
    return await extracted(testSuites, async ()=>{
        await import(path.resolve(process.cwd(), "generated/src/_test_setup.js"));
        return testSuites;
    });
    async function loadModuleAsync(filename) {
        const errorName = `error when importing ${path.basename(filename)}`;
        if (!path.isAbsolute(filename)) {
            return createFailure(errorName, `Test module filenames must use absolute paths: ${filename}`);
        }
        try {
            const { default: suite } = await import(filename);
            if (suite instanceof TestSuite) {
                suite._setFilename(filename);
                return suite;
            } else {
                return createFailure(errorName, `Test module doesn't export a test suite: ${filename}`, filename);
            }
        } catch (err) {
            return createFailure(errorName, err, filename);
        }
    }
    function createFailure(name, error, filename) {
        return TestSuite.create({
            tests: [
                new FailureTestCase([
                    name
                ], error, filename)
            ]
        });
    }
}
async function extracted(testSuites, fn) {
    const builder = context.setup("setup");
    try {
        await fn();
        builder._tests = testSuites;
        return builder.toTestSuite();
    } finally{
        context.endSetup();
    }
}

//# sourceMappingURL=loader.js.map
