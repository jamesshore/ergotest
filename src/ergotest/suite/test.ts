// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RenderErrorFn, TestCaseResult, TestMarkValue, TestResult } from "../results/test_result.js";
import { Clock } from "../../infrastructure/clock.js";
import { RunData, TestConfig } from "./test_suite.js";
import { BeforeAfter } from "./before_after.js";

export interface RunOptions {
	clock: Clock,
	onTestCaseResult: (testResult: TestCaseResult) => void,
	config: TestConfig,
	renderError?: RenderErrorFn,
}

export interface Test {
	_runAsyncInternal: (
		options: RunOptions,
		parentData: RunData,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (mark: TestMarkValue) => boolean,
}

export type Milliseconds = number;

