// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { RunResult, TestCaseResult, TestMark, TestResult, TestStatus, TestSuiteResult } from "./test_result.js";
import { Colors } from "../../infrastructure/colors.js";
import path from "node:path";
import { AssertionError } from "node:assert";
import util from "node:util";
import { SourceMap } from "../../infrastructure/source_map.js";
const headerColor = Colors.brightWhite.bold;
const highlightColor = Colors.brightWhite;
const stackHighlightColor = Colors.brightYellow.bold;
const errorMessageColor = Colors.brightRed;
const timeoutMessageColor = Colors.purple;
const expectedColor = Colors.green;
const actualColor = Colors.brightRed;
const diffColor = Colors.brightYellow.bold;
const summaryColor = Colors.brightWhite.dim;
/**
 * Converts an error into a detailed description of a test failure. Intended to be used with {@link TestOptions}
 * rather than called directly.
 * @param {string[]} name The names of the test
 * @param {unknown} error The error that occurred
 * @param {string} [filename] The file that contained the test, if known
 * @return The description
 */ export function renderError(name, error, filename) {
    ensure.signature(arguments, [
        Array,
        ensure.ANY_TYPE,
        [
            undefined,
            String
        ]
    ]);
    const finalName = normalizeName(name).pop();
    let renderedError;
    if (error instanceof Error && error?.stack !== undefined) {
        renderedError = renderStack(error, filename);
        if (error.message !== undefined && error.message !== "") {
            renderedError += "\n\n" + highlightColor(`${finalName} »\n`) + errorMessageColor(`${error.message}`);
        }
    } else if (typeof error === "string") {
        renderedError = errorMessageColor(error);
    } else {
        renderedError = errorMessageColor(util.inspect(error));
    }
    const diff = error instanceof AssertionError && (error.expected !== undefined || error.actual !== undefined) ? "\n\n" + renderDiff(error) : "";
    return `${renderedError}${diff}`;
}
/**
 * Provides an error's stack trace, or "" if there wasn't one. If `filename` is provided, the stack frames that
 * correspond to the filename will be highlighted.
 * @param {unknown} error The error
 * @param {string} [filename] The filename to highlight
 * @param [sourceMap] Internal use only
 * @returns {string} The stack trace for the test, or "" if there wasn't one.
 */ export function renderStack(error, filename, sourceMap = SourceMap.create()) {
    ensure.signature(arguments, [
        ensure.ANY_TYPE,
        [
            undefined,
            String
        ],
        [
            undefined,
            SourceMap
        ]
    ]);
    const stack = error instanceof AssertionError ? error.stack ?? "" : util.inspect(error);
    if (filename === undefined) return stack;
    let filenamesToHighlight = sourceMap.getOriginalFilenames(filename);
    if (filenamesToHighlight.length === 0) filenamesToHighlight = [
        filename
    ];
    const lines = stack.split("\n");
    const highlightedLines = lines.map((line)=>{
        const shouldHighlight = filenamesToHighlight.some((filename)=>line.includes(filename));
        if (!shouldHighlight) return line;
        line = line.replace(/    at/, "--> at"); // this code is vulnerable to changes in Node.js rendering
        return stackHighlightColor(line);
    });
    return highlightedLines.join("\n");
}
/**
 *
 * @returns {string} A comparison of expected and actual values, or "" if there weren't any.
 */ export function renderDiff(error) {
    ensure.signature(arguments, [
        AssertionError
    ]);
    if (error.expected === undefined && error.actual === undefined) return "";
    if (error.expected === null && error.actual === null) return "";
    const expected = util.inspect(error.expected, {
        depth: Infinity
    }).split("\n");
    const actual = util.inspect(error.actual, {
        depth: Infinity
    }).split("\n");
    if (expected.length > 1 || actual.length > 1) {
        for(let i = 0; i < Math.max(expected.length, actual.length); i++){
            const expectedLine = expected[i];
            const actualLine = actual[i];
            if (expectedLine !== actualLine) {
                if (expected[i] !== undefined) expected[i] = diffColor(expected[i]);
                if (actual[i] !== undefined) actual[i] = diffColor(actual[i]);
            }
        }
    }
    return "" + expectedColor("expected: ") + expected.join("\n") + "\n" + actualColor("actual:   ") + actual.join("\n");
}
export class TestRenderer {
    static create() {
        ensure.signature(arguments, []);
        return new TestRenderer();
    }
    // can't use a normal constant due to a circular dependency between TestResult and TestRenderer
    static get #PROGRESS_RENDERING() {
        return {
            [TestStatus.pass]: ".",
            [TestStatus.fail]: Colors.brightRed.inverse("X"),
            [TestStatus.skip]: Colors.cyan.dim("_"),
            [TestStatus.timeout]: Colors.purple.inverse("!")
        };
    }
    // can't use a normal constant due to a circular dependency between TestResult and TestRenderer
    static get #DESCRIPTION_RENDERING() {
        return {
            [TestStatus.pass]: Colors.green("passed"),
            [TestStatus.fail]: Colors.brightRed("failed"),
            [TestStatus.skip]: Colors.brightCyan("skipped"),
            [TestStatus.timeout]: Colors.brightPurple("timeout")
        };
    }
    /**
	 * @param {TestSuiteResult} testSuiteResult The test suite to render.
	 * @param {number} [elapsedMs] The total time required to run the test suite, in milliseconds.
	 * @returns {string} A summary of the results of a test suite, including the average time required per test if
	 *   `elapsedMs` is defined.
	 */ renderSummary(testSuiteResult, elapsedMs) {
        ensure.signature(arguments, [
            TestSuiteResult,
            [
                undefined,
                Number
            ]
        ]);
        const { total, pass, fail, timeout, skip } = testSuiteResult.count();
        const renders = [
            renderCount(fail, "failed", Colors.brightRed),
            renderCount(timeout, "timed out", Colors.purple),
            renderCount(skip, "skipped", Colors.cyan),
            renderCount(pass, "passed", Colors.green),
            renderMsEach(elapsedMs, total, skip)
        ].filter((render)=>render !== "");
        return summaryColor("(") + renders.join(summaryColor("; ")) + summaryColor(")");
        function renderCount(number, description, color) {
            if (number === 0) {
                return "";
            } else {
                return color(`${number} ${description}`);
            }
        }
        function renderMsEach(elapsedMs, total, skip) {
            if (total - skip === 0) return summaryColor("none ran");
            if (elapsedMs === undefined) return "";
            const msEach = (elapsedMs / (total - skip)).toFixed(1);
            return summaryColor(`${msEach}ms avg.`);
        }
    }
    /**
	 * @param {TestCaseResult | TestCaseResult[]} The tests to render.
	 * @returns {string} A single character for each test: a dot for passed, a red X for failed, etc.
	 */ renderAsCharacters(testCaseResults) {
        ensure.signature(arguments, [
            [
                TestCaseResult,
                RunResult,
                Array
            ]
        ]);
        return renderMultipleResults(testCaseResults, "", TestCaseResult, (testResult)=>{
            return TestRenderer.#PROGRESS_RENDERING[testResult.status];
        });
    }
    /**
	 * @param {TestCaseResult | TestCaseResult[]} The tests to render.
	 * @returns {string} A line for each test with the status (passed, failed, etc.) and the test name.
	 */ renderAsSingleLines(testCaseResults) {
        ensure.signature(arguments, [
            [
                TestCaseResult,
                Array
            ]
        ]);
        const self = this;
        return renderMultipleResults(testCaseResults, "\n", TestCaseResult, (testResult)=>{
            return showTestDetail(testResult) ? renderDetail(testResult) : renderResult(testResult);
        });
        function renderDetail(testResult) {
            const separator = `\n  ${summaryColor("-->")}  `;
            const beforeAfter = [
                ...testResult.beforeEach,
                ...testResult.afterEach
            ];
            const details = renderMultipleResults(beforeAfter, separator, RunResult, (detail)=>renderResult(detail));
            return renderResult(testResult) + `${separator}${self.renderStatusAsSingleWord(testResult.it.status)} the test itself` + separator + details;
        }
        function renderResult(result) {
            if (result instanceof RunResult) result = TestCaseResult.create({
                it: result
            });
            const status = self.renderStatusAsSingleWord(result.status);
            const name = self.renderNameOnOneLine(result.name, result.filename);
            return `${status} ${name}`;
        }
    }
    /**
	 * @param {TestCaseResult | TestCaseResult[]} The tests to render.
	 * @returns {string} A full explanation of this test result.
	 */ renderAsMultipleLines(testCaseResults) {
        ensure.signature(arguments, [
            [
                TestSuiteResult,
                TestCaseResult,
                Array
            ]
        ]);
        const self = this;
        return renderMultipleResults(testCaseResults, "\n\n\n", TestCaseResult, (testResult)=>{
            const name = this.renderNameOnMultipleLines(testResult.name, testResult.filename);
            if (showTestDetail(testResult)) {
                return renderDetail(testResult);
            } else {
                const status = this.renderStatusWithMultiLineDetails(testResult.it);
                return `${name}\n\n${status}`;
            }
        });
        function renderDetail(testResult) {
            const chevrons = headerColor(`»»» `);
            const beforeAfter = [
                ...testResult.beforeEach,
                ...testResult.afterEach
            ];
            const details = renderMultipleResults(beforeAfter, `\n\n`, RunResult, (detail)=>{
                const status = self.renderStatusWithMultiLineDetails(detail);
                const finalName = normalizeName(detail.name).pop();
                return chevrons + headerColor(finalName) + "\n" + self.renderNameOnOneLine(detail.name, detail.filename) + "\n\n" + status;
            });
            const test = testResult.it;
            return self.renderNameOnMultipleLines(test.name, test.filename) + "\n\n" + details + "\n\n" + chevrons + headerColor("the test itself") + "\n" + self.renderNameOnOneLine(test.name, test.filename) + "\n\n" + self.renderStatusWithMultiLineDetails(test) + "\n\n" + headerColor("«««");
        }
    }
    /**
	 * @param {TestResult | TestResult[]} The tests or suites to render.
	 * @returns {string} A line for each test or suite that's marked (.only, .skip, etc.) with the mark and the test name.
	 */ renderMarksAsLines(testResults) {
        ensure.signature(arguments, [
            [
                TestSuiteResult,
                TestCaseResult,
                Array
            ]
        ]);
        return renderMultipleResults(testResults, "\n", TestResult, (testResult)=>{
            const mark = this.renderMarkAsSingleWord(testResult.mark);
            const name = this.renderNameOnOneLine(testResult.name, testResult.filename);
            if (mark === "") return "";
            else return `${mark} ${name}`;
        });
    }
    /**
	 * @param { string[] } name The name to render.
	 * @param { string? } [filename] The filename to render.
	 * @returns {string} The name of the test, including parent suites and filename, rendered as a single line. Only the
	 *   filename is rendered; the rest of the path is ignored.
	 */ renderNameOnOneLine(name, filename) {
        ensure.signature(arguments, [
            Array,
            [
                undefined,
                String
            ]
        ]);
        const renderedFilename = filename === undefined ? "" : headerColor(path.basename(filename)) + " » ";
        const renderedName = normalizeName(name).join(" » ");
        return `${renderedFilename}${renderedName}`;
    }
    /**
	 * @param { string[] } name The name to render.
	 * @param { string? } [filename] The filename to render.	 *
	 * @returns {string} The name of the test, including parent suites and filename, with the suites and filename
	 *   rendered on a separate line. Only the filename is rendered; the rest of the path is ignored.
	 */ renderNameOnMultipleLines(name, filename) {
        ensure.signature(arguments, [
            Array,
            [
                undefined,
                String
            ]
        ]);
        name = normalizeName(name);
        const suites = name.slice(0, name.length - 1);
        const test = name[name.length - 1];
        if (filename !== undefined) suites.unshift(path.basename(filename));
        const suitesName = suites.length > 0 ? headerColor(suites[0]) + suites.slice(1).map((name)=>` » ${name}`).join("") + "\n" + headerColor("» ") : "";
        return suitesName + headerColor(test);
    }
    /**
	 * @param { TestStatusValue } status The status to render.
	 * @returns {string} The color-coded status.
	 */ renderStatusAsSingleWord(status) {
        ensure.signature(arguments, [
            String
        ]);
        return TestRenderer.#DESCRIPTION_RENDERING[status];
    }
    /**
	 * @param { RunResult } status The result to render.
	 * @returns { string } The color-coded status, including error and timeout details where appropriate.
	 */ renderStatusWithMultiLineDetails(runResult) {
        ensure.signature(arguments, [
            RunResult
        ]);
        switch(runResult.status){
            case TestStatus.pass:
            case TestStatus.skip:
                return TestRenderer.#DESCRIPTION_RENDERING[runResult.status];
            case TestStatus.fail:
                return typeof runResult.errorRender === "string" ? runResult.errorRender : util.inspect(runResult.errorRender, {
                    depth: Infinity
                });
            case TestStatus.timeout:
                return timeoutMessageColor(`Timed out after ${runResult.timeout}ms`);
            default:
                throw new Error(`Unrecognized test result status: ${runResult.status}`);
        }
    }
    /**
	 * @param { TestMarkValue } mark The mark.
	 * @returns {string} The color-coded mark of the test result (.only, etc.), or "" if the test result wasn't marked.
	 */ renderMarkAsSingleWord(mark) {
        ensure.signature(arguments, [
            String
        ]);
        switch(mark){
            case TestMark.none:
                return "(no mark)";
            case TestMark.skip:
                return Colors.brightCyan(".skip");
            case TestMark.only:
                return Colors.brightCyan(".only");
            default:
                ensure.unreachable(`Unrecognized test mark: ${mark}`);
        }
    }
}
function normalizeName(name) {
    return name.length === 0 ? [
        "(no name)"
    ] : [
        ...name
    ];
}
function showTestDetail(testResult) {
    const beforeAfter = [
        ...testResult.beforeEach,
        ...testResult.afterEach
    ];
    const allBeforeAfterPass = beforeAfter.every((result)=>result.status === TestStatus.pass);
    const allBeforeAfterSkipped = beforeAfter.every((result)=>result.status === TestStatus.skip);
    return !(allBeforeAfterPass || allBeforeAfterSkipped && testResult.it.status === TestStatus.skip);
}
function renderMultipleResults(testResults, separator, expectedType, renderFn) {
    if (!Array.isArray(testResults)) testResults = [
        testResults
    ];
    testResults.forEach((result, i)=>ensure.type(result, expectedType, `testResult[${i}]`));
    return testResults.map((result)=>renderFn(result)).join(separator);
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/results/test_renderer.js.map
