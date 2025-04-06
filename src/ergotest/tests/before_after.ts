// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunData, RunOptions } from "./test_suite.js";
import { TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
import { ItFn, ItOptions } from "./test_api.js";

export class BeforeAfter {

	private readonly _runnable: Runnable;

	static create({
		name,
		options = {},
		fnAsync
	}: {
		name: string[],
		options?: ItOptions,
		fnAsync: ItFn,
	}) {
		return new BeforeAfter(Runnable.create(name, options, fnAsync));
	}

	constructor(runnable: Runnable) {
		this._runnable = runnable;
	}

	async runBeforeAfterAllAsync(runOptions: RunOptions, runData: RunData) {
		const result = TestCaseResult.create({
			it: await this._runnable.runAsync(runOptions, runData),
		});
		runOptions.onTestCaseResult(result);

		return result;
	}

	async runBeforeAfterEachAsync(runOptions: RunOptions, runData: RunData) {
		return await this._runnable.runAsync(runOptions, runData);
	}
}