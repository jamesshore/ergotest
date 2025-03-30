// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RenderErrorFn, TestCaseResult, TestMarkValue, TestResult } from "../results/test_result.js";
import { Clock } from "../../infrastructure/clock.js";
import { TestConfig } from "./test_suite.js";
import { BeforeAfterDefinition } from "./before_after.js";

export interface RecursiveRunOptions {
	name: string[];
	filename?: string;
	clock: Clock,
	onTestCaseResult: (testResult: TestCaseResult) => void,
	timeout: Milliseconds,
	config: TestConfig,
	renderError?: RenderErrorFn,
}

export interface Test {
	_recursiveRunAsync: (
		parentMark: TestMarkValue,
		parentBeforeEachFns: BeforeAfterDefinition[],
		parentAfterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (mark: TestMarkValue) => boolean,
}

export type Milliseconds = number;

