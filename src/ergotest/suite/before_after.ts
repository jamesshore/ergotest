// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { ItFn, ItOptions } from "../test_api.js";
import { RunOptions } from "./test.js";
import { RunData } from "./test_suite.js";
import { RunResult } from "../results/test_result.js";
import { runTestFnAsync } from "./runnable_function.js";

export class BeforeAfter {
	private readonly _name: string[];
	private readonly _options: ItOptions;
	private readonly _fnAsync: ItFn;

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

	constructor(name: string[], options: ItOptions, fnAsync: ItFn) {
		this._name = name;
		this._options = options;
		this._fnAsync = fnAsync;
	}

	get name(): string[] {
		return this._name;
	}

	get options(): ItOptions {
		return this._options;
	}

	get fnAsync(): ItFn {
		return this._fnAsync;
	}

	async _runAsyncInternal(runOptions: RunOptions, runData: RunData) {
		if (runData.skipAll) return RunResult.skip({ name: this.name, filename: runData.filename });

		return await runTestFnAsync(this.name, this.fnAsync, this.options.timeout, runOptions, runData);
	}

}