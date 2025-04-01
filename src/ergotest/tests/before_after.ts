// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { RunOptions } from "./test.js";
import { RunData } from "./test_suite.js";
import { RunResult, TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
import { ItFn, ItOptions } from "./api_context.js";

export class BeforeAfter extends Runnable {

	static create({
		name,
		options = {},
		fnAsync
	}: {
		name: string[],
		options?: ItOptions,
		fnAsync: ItFn,
	}) {
		return new BeforeAfter(name, options, fnAsync);
	}

	async runBeforeAfterAllAsync(runOptions: RunOptions, runData: RunData) {
		const result = TestCaseResult.create({
			it: await this._runAsyncInternal(runOptions, runData),
		});

		runOptions.onTestCaseResult(result);
		return result;
	}

	async runBeforeAfterEachAsync(runOptions: RunOptions, runData: RunData) {
		return await this._runAsyncInternal(runOptions, runData);
	}

	async _runAsyncInternal(runOptions: RunOptions, runData: RunData) {
		if (runData.skipAll) return RunResult.skip({ name: this.name, filename: runData.filename });

		return await this._runTestFnAsync(runOptions, runData);
	}

}